import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  BOOKEO_PEOPLE_CATEGORY_ID,
  LOCATIONS,
} from "@/app/data/locations";
import {
  getEasternDayBounds,
} from "@/app/lib/booking";

import { fetchAllBookeoBookingPages } from "@/app/lib/bookeoBookingsPagination";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_RECONCILE_TIMEOUT_MS =
  15_000;

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
  status:
    | "needs_recovery"
    | "reconciled"
    | "recovered";
  failureType:
    | "bookeo_rejected"
    | "uncertain";
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

export async function POST(
  request: Request
) {
  try {
    /*
     * Protect the administrative endpoint from
     * unlimited secret-guessing and Bookeo requests.
     */
    const forwardedFor =
      request.headers.get(
        "x-forwarded-for"
      );

    const ip =
      forwardedFor
        ?.split(",")[0]
        ?.trim() ||
      request.headers.get(
        "x-real-ip"
      ) ||
      "unknown";

    const rateLimitKey =
      `rate-limit:admin-reconcile:${ip}`;

    const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      600
    );

    if (attempts > 20) {
      return NextResponse.json(
        {
          error:
            "Too many recovery administration requests.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

    const adminSecret =
      process.env.ADMIN_RECOVERY_SECRET;

    if (!adminSecret) {
      console.error(
        "Recovery administration is not configured."
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
      request.headers.get(
        "x-admin-secret"
      );

    if (
      suppliedSecret !==
      adminSecret
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const body =
      await request.json();

    const sessionId =
      String(
        body.sessionId || ""
      ).trim();

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    if (
      sessionId.length > 100 ||
      !/^ERM-[0-9a-f-]+$/i.test(
        sessionId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid booking session ID.",
        },
        { status: 400 }
      );
    }

    const orphan =
      await redis.get<OrphanPayment>(
        `orphan-payment:${sessionId}`
      );

    if (!orphan) {
      return NextResponse.json(
        {
          error:
            "Orphan payment not found.",
        },
        { status: 404 }
      );
    }

    const BOOKEO_API_KEY =
      orphan.location ===
      LOCATIONS.cherryHill.slug
        ? BOOKEO_CH_API_KEY
        : orphan.location ===
            LOCATIONS.kingOfPrussia.slug
          ? BOOKEO_KOP_API_KEY
          : null;

    if (
      !BOOKEO_API_KEY ||
      !BOOKEO_SECRET_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid Bookeo location/credentials.",
        },
        { status: 500 }
      );
    }

    /*
     * If this session has already been finalized,
     * reconciliation is unnecessary.
     */
    const existingFinalization =
      await redis.get<{
        sessionId: string;
        bookingId: string;
        transactionId: string;
        finalizedAt: number;
      }>(
        `bookeo-finalized:${sessionId}`
      );

    if (
      existingFinalization
    ) {
      return NextResponse.json({
        result:
          "already_finalized",
        bookingNumber:
          existingFinalization.bookingId,
      });
    }

    if (!orphan.date) {
      return NextResponse.json(
        {
          result:
            "manual_review_required",
          error:
            "Orphan does not contain a booking date.",
        },
        { status: 409 }
      );
    }

    /*
     * Query Bookeo for bookings on the
     * scheduled date for this exact product.
     *
     * This endpoint NEVER creates a booking.
     */
    const {
      startTime,
      endTime,
    } =
      getEasternDayBounds(
        orphan.date
      );

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?startTime=${encodeURIComponent(
        startTime
      )}` +
      `&endTime=${encodeURIComponent(
        endTime
      )}` +
      `&productId=${encodeURIComponent(
        orphan.productId
      )}`;

    const bookingPages =
      await fetchAllBookeoBookingPages<BookeoBooking>(
        url,
        BOOKEO_API_KEY,
        BOOKEO_SECRET_KEY,
        BOOKEO_RECONCILE_TIMEOUT_MS
      );

    if (!bookingPages.ok) {
      console.error(
        "Bookeo reconciliation query failed.",
        {
          sessionId,
          status:
            bookingPages.status,
        }
      );

      return NextResponse.json(
        {
          error:
            "Could not query all Bookeo pages for reconciliation.",
          bookeoStatus:
            bookingPages.status,
        },
        { status: 502 }
      );
    }

    const bookings =
      bookingPages.bookings;

    /*
     * Match only active bookings for this exact
     * Bookeo product and event.
     */
    const eventMatches =
      bookings.filter(
        (booking) =>
          booking.productId ===
            orphan.productId &&
          booking.eventId ===
            orphan.eventId &&
          booking.canceled !==
            true
      );

    const orphanPlayers =
      Number(
        orphan.players
      );

    const orphanAmount =
      Number(
        orphan.amount
      );

    /*
     * Require positive evidence for participant
     * count and paid amount.
     */
    const strongMatches =
      eventMatches.filter(
        (booking) => {
          const participants =
            booking.participants
              ?.numbers?.find(
                (participant) =>
                  participant.peopleCategoryId ===
                  BOOKEO_PEOPLE_CATEGORY_ID
              )?.number;

          const paidAmount =
            Number(
              booking.price
                ?.totalPaid
                ?.amount
            );

          if (
            !Number.isFinite(
              participants
            ) ||
            !Number.isFinite(
              orphanPlayers
            ) ||
            participants !==
              orphanPlayers
          ) {
            return false;
          }

          if (
            !Number.isFinite(
              paidAmount
            ) ||
            !Number.isFinite(
              orphanAmount
            ) ||
            Math.abs(
              paidAmount -
                orphanAmount
            ) >= 0.001
          ) {
            return false;
          }

          return true;
        }
      );

    /*
     * Exactly one strong match is required.
     *
     * Zero means no existing booking can be proven.
     * Multiple means the result is ambiguous.
     */
    if (
      strongMatches.length !==
      1
    ) {
      const result =
        strongMatches.length ===
        0
          ? "no_match"
          : "ambiguous";

      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,
          lastReconciliationResult:
            result,
          lastReconciledAt:
            Date.now(),
          eventMatches:
            eventMatches.length,
          strongMatches:
            strongMatches.length,
        },
        {
          ex:
            60 *
            60 *
            24 *
            30,
        }
      );

      return NextResponse.json({
        result,
        sessionId,
        eventMatches:
          eventMatches.length,
        strongMatches:
          strongMatches.length,

        candidates:
          strongMatches.map(
            (booking) => ({
              bookingNumber:
                booking.bookingNumber,
              eventId:
                booking.eventId,
              productId:
                booking.productId,
              startTime:
                booking.startTime,
              creationTime:
                booking.creationTime,
              title:
                booking.title,

              players:
                booking
                  .participants
                  ?.numbers?.find(
                    (
                      participant
                    ) =>
                      participant.peopleCategoryId ===
                      BOOKEO_PEOPLE_CATEGORY_ID
                  )?.number ??
                null,

              totalPaid:
                booking.price
                  ?.totalPaid
                  ?.amount ??
                null,
            })
          ),
      });
    }

    const match =
      strongMatches[0];

    const bookingNumber =
      String(
        match.bookingNumber ||
          ""
      );

    if (!bookingNumber) {
      return NextResponse.json(
        {
          result:
            "manual_review_required",
          error:
            "Matched Bookeo booking has no booking number.",
        },
        { status: 409 }
      );
    }

    /*
     * Exactly one existing Bookeo booking matched.
     * Record that result without creating anything.
     */
    await redis.set(
      `bookeo-finalized:${sessionId}`,
      {
        sessionId,
        bookingId:
          bookingNumber,
        transactionId:
          orphan.transactionId,
        finalizedAt:
          Date.now(),
        reconciled:
          true,
      },
      {
        ex:
          60 *
          60 *
          24 *
          90,
      }
    );

    await redis.set(
      `orphan-payment:${sessionId}`,
      {
        ...orphan,
        status:
          "reconciled",
        reconciledBookingNumber:
          bookingNumber,
        reconciledAt:
          Date.now(),
      },
      {
        ex:
          60 *
          60 *
          24 *
          30,
      }
    );

    return NextResponse.json({
      result:
        "reconciled",
      sessionId,
      bookingNumber,
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (
        error.name ===
          "TimeoutError" ||
        error.name ===
          "AbortError"
      );

    console.error(
      "Bookeo reconciliation request failed.",
      {
        reason:
          isTimeout
            ? "timeout"
            : "request_error",
      }
    );

    return NextResponse.json(
      {
        error:
          isTimeout
            ? "Bookeo took too long to respond during reconciliation."
            : "Could not reconcile orphan payment.",
      },
      {
        status:
          isTimeout
            ? 504
            : 500,
      }
    );
  }
}