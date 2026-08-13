import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY = process.env.BOOKEO_KOP_API_KEY;
const BOOKEO_CH_API_KEY = process.env.BOOKEO_CH_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

type OrphanPayment = {
  sessionId: string;
  transactionId: string;
  amount: string;
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bookeoError: unknown;
  createdAt: number;
  status: "needs_recovery" | "reconciled" | "recovered";
  failureType: "bookeo_rejected" | "uncertain";
};

type BookeoBooking = {
  bookingNumber?: string;
  eventId?: string;
  productId?: string;
  startTime?: string;
  creationTime?: string;
  title?: string;
  canceled?: boolean;
  participants?: {
    numbers?: Array<{
      peopleCategoryId?: string;
      number?: number;
    }>;
  };
  price?: {
    totalPaid?: {
      amount?: string;
      currency?: string;
    };
  };
};

export async function POST(request: Request) {
  try {
    const adminSecret = process.env.ADMIN_RECOVERY_SECRET;

    if (!adminSecret) {
      console.error(
        "ADMIN_RECOVERY_SECRET is not configured."
      );

      return NextResponse.json(
        {
          error:
            "Recovery administration is not configured.",
        },
        { status: 500 }
      );
    }

    const suppliedSecret =
      request.headers.get("x-admin-secret");

    if (suppliedSecret !== adminSecret) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    const orphan = await redis.get<OrphanPayment>(
      `orphan-payment:${sessionId}`
    );

    if (!orphan) {
      return NextResponse.json(
        { error: "Orphan payment not found." },
        { status: 404 }
      );
    }

    const BOOKEO_API_KEY =
      orphan.location === "cherry-hill"
        ? BOOKEO_CH_API_KEY
        : orphan.location === "king-of-prussia"
          ? BOOKEO_KOP_API_KEY
          : null;

    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing or invalid Bookeo location/credentials." },
        { status: 500 }
      );
    }
    /*
     * If this session was already successfully finalized,
     * there is nothing left to reconcile.
     */
    const existingFinalization = await redis.get<{
      sessionId: string;
      bookingId: string;
      transactionId: string;
      finalizedAt: number;
    }>(`bookeo-finalized:${sessionId}`);

    if (existingFinalization) {
      return NextResponse.json({
        result: "already_finalized",
        bookingNumber: existingFinalization.bookingId,
      });
    }

    if (!orphan.date) {
      return NextResponse.json(
        {
          result: "manual_review_required",
          error:
            "Orphan does not contain a booking date.",
        },
        { status: 409 }
      );
    }

    /*
     * Query Bookeo for bookings on the scheduled date
     * for this exact product.
     *
     * Bookeo documents -00:00 as meaning the Bookeo
     * account's local timezone.
     */
    const startTime =
      `${orphan.date}T00:00:00-00:00`;

    const endTime =
      `${orphan.date}T23:59:59-00:00`;

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?apiKey=${encodeURIComponent(BOOKEO_API_KEY)}` +
      `&secretKey=${encodeURIComponent(BOOKEO_SECRET_KEY)}` +
      `&startTime=${encodeURIComponent(startTime)}` +
      `&endTime=${encodeURIComponent(endTime)}` +
      `&productId=${encodeURIComponent(orphan.productId)}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "BOOKEO RECONCILIATION QUERY ERROR:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          error:
            "Could not query Bookeo for reconciliation.",
          bookeoStatus: response.status,
        },
        { status: 502 }
      );
    }

    const bookings: BookeoBooking[] =
      Array.isArray(data?.data) ? data.data : [];

    /*
     * Match only active bookings for the exact
     * Bookeo product and exact Bookeo event.
     */
    const eventMatches = bookings.filter(
      (booking) =>
        booking.productId === orphan.productId &&
        booking.eventId === orphan.eventId &&
        booking.canceled !== true
    );

    const orphanPlayers = Number(orphan.players);
    const orphanAmount = Number(orphan.amount);

    /*
     * Narrow using participant count and total paid.
     *
     * Unlike the previous version, missing Bookeo values
     * DO NOT count as matches. We require positive evidence.
     */
    const strongMatches = eventMatches.filter((booking) => {
      const adults =
        booking.participants?.numbers?.find(
          (participant) =>
            participant.peopleCategoryId === "Cadults"
        )?.number;

      const paidAmount = Number(
        booking.price?.totalPaid?.amount
      );

      if (
        !Number.isFinite(adults) ||
        !Number.isFinite(orphanPlayers) ||
        adults !== orphanPlayers
      ) {
        return false;
      }

      if (
        !Number.isFinite(paidAmount) ||
        !Number.isFinite(orphanAmount) ||
        Math.abs(paidAmount - orphanAmount) >= 0.001
      ) {
        return false;
      }

      return true;
    });

    /*
     * Exactly one strong match is required.
     *
     * Zero means we cannot prove Bookeo created it.
     * Multiple means the result is ambiguous.
     *
     * This endpoint NEVER creates a new booking.
     */
    if (strongMatches.length !== 1) {
      const result =
        strongMatches.length === 0
          ? "no_match"
          : "ambiguous";

      /*
      * Preserve the reconciliation result.
      *
      * A later recovery action may proceed only when
      * reconciliation explicitly found zero existing
      * Bookeo bookings matching this paid transaction.
      */
      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,
          lastReconciliationResult: result,
          lastReconciledAt: Date.now(),
          eventMatches: eventMatches.length,
          strongMatches: strongMatches.length,
        },
        {
          ex: 60 * 60 * 24 * 30,
        }
      );

      return NextResponse.json({
        result,
        sessionId,
        eventMatches: eventMatches.length,
        strongMatches: strongMatches.length,
        candidates: strongMatches.map((booking) => ({
          bookingNumber: booking.bookingNumber,
          eventId: booking.eventId,
          productId: booking.productId,
          startTime: booking.startTime,
          creationTime: booking.creationTime,
          title: booking.title,
          players:
            booking.participants?.numbers?.find(
              (participant) =>
                participant.peopleCategoryId === "Cadults"
            )?.number ?? null,
          totalPaid:
            booking.price?.totalPaid?.amount ?? null,
        })),
      });
    }

    const match = strongMatches[0];

    const bookingNumber = String(
      match.bookingNumber || ""
    );

    if (!bookingNumber) {
      return NextResponse.json(
        {
          result: "manual_review_required",
          error:
            "Matched Bookeo booking has no booking number.",
        },
        { status: 409 }
      );
    }

    /*
     * We found exactly one existing Bookeo booking
     * matching the orphan.
     *
     * Record that fact in Redis. We are NOT creating
     * anything in Bookeo here.
     */
    await redis.set(
      `bookeo-finalized:${sessionId}`,
      {
        sessionId,
        bookingId: bookingNumber,
        transactionId: orphan.transactionId,
        finalizedAt: Date.now(),
        reconciled: true,
      },
      {
        ex: 60 * 60 * 24 * 90,
      }
    );

    await redis.set(
      `orphan-payment:${sessionId}`,
      {
        ...orphan,
        status: "reconciled",
        reconciledBookingNumber: bookingNumber,
        reconciledAt: Date.now(),
      },
      {
        ex: 60 * 60 * 24 * 30,
      }
    );

    return NextResponse.json({
      result: "reconciled",
      sessionId,
      bookingNumber,
    });
  } catch (error) {
    console.error(
      "BOOKEO RECONCILIATION ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Could not reconcile orphan payment.",
      },
      { status: 500 }
    );
  }
}