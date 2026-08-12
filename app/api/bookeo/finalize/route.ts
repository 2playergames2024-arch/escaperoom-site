import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

type BookingSession = {
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
  total: string;
  createdAt: number;
};

type VerifiedPayment = {
  sessionId: string;
  transactionId: string;
  amount: string;
  transactionStatus: string;
  verifiedAt: number;
};

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

type FinalizedBooking = {
  sessionId: string;
  bookingId: string;
  transactionId: string;
  finalizedAt: number;
};

export async function POST(request: Request) {
  let sessionId = "";
  let lockToken = "";
  let lockAcquired = false;

  try {
    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing Bookeo API credentials" },
        { status: 500 }
      );
    }

    const body = await request.json();
    sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    /*
     * Do not trust booking details sent by the browser.
     * Retrieve the real booking session from Redis.
     */
    const session = await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

    if (!session) {
      return NextResponse.json(
        { error: "Booking session not found." },
        { status: 404 }
      );
    }

    /*
     * IDEMPOTENCY GATE:
     * If this session has already been finalized,
     * return the existing Bookeo booking instead of
     * attempting another booking.
     */
    const existingFinalization =
      await redis.get<FinalizedBooking>(
        `bookeo-finalized:${sessionId}`
      );

    if (existingFinalization) {
      return NextResponse.json({
        status: 200,
        data: {
          id: existingFinalization.bookingId,
        },
        alreadyFinalized: true,
      });
    }

    /*
     * HARD PAYMENT SECURITY GATE:
     * Bookeo cannot be finalized unless Authorize.net
     * payment has been independently verified.
     */
    const verifiedPayment = await redis.get<VerifiedPayment>(
      `verified-payment:${sessionId}`
    );

    if (!verifiedPayment) {
      return NextResponse.json(
        {
          error:
            "Payment has not been independently verified.",
        },
        { status: 403 }
      );
    }

    const expectedAmount = Number(session.total);
    const verifiedAmount = Number(verifiedPayment.amount);

    if (
      verifiedPayment.sessionId !== sessionId ||
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(verifiedAmount) ||
      Math.abs(expectedAmount - verifiedAmount) >= 0.001
    ) {
      return NextResponse.json(
        {
          error:
            "Verified payment does not match this booking.",
        },
        { status: 403 }
      );
    }

    /*
     * ATOMIC FINALIZATION LOCK:
     *
     * Redis SET NX means only one request can acquire
     * this session's finalize lock.
     *
     * The expiration prevents a permanently stuck lock
     * if the server dies unexpectedly.
     */
    lockToken = crypto.randomUUID();

    const lockResult = await redis.set(
      `bookeo-finalize-lock:${sessionId}`,
      lockToken,
      {
        nx: true,
        ex: 120,
      }
    );

    if (lockResult !== "OK") {
      /*
       * Another request is currently finalizing this
       * exact booking. Do not call Bookeo again.
       */
      return NextResponse.json(
        {
          error: "Booking finalization is already in progress.",
          retryable: true,
        },
        { status: 409 }
      );
    }

    lockAcquired = true;

    /*
     * Check again AFTER obtaining the lock.
     *
     * Another request could have completed between our
     * first finalized check and acquiring the lock.
     */
    const finalizedAfterLock =
      await redis.get<FinalizedBooking>(
        `bookeo-finalized:${sessionId}`
      );

    if (finalizedAfterLock) {
      return NextResponse.json({
        status: 200,
        data: {
          id: finalizedAfterLock.bookingId,
        },
        alreadyFinalized: true,
      });
    }

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?apiKey=${BOOKEO_API_KEY}` +
      `&secretKey=${BOOKEO_SECRET_KEY}` +
      `&previousHoldId=${encodeURIComponent(session.holdId)}`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: session.productId,
        eventId: session.eventId,

        participants: {
          numbers: [
            {
              peopleCategoryId: "Cadults",
              number: Number(session.players),
            },
          ],
        },

        customer: {
          firstName: session.firstName || "",
          lastName: session.lastName || "",
          emailAddress: session.email || "",
          phoneNumbers: session.phone
            ? [
                {
                  number: session.phone,
                  type: "mobile",
                },
              ]
            : [],
        },

        initialPayments: [
          {
            reason: "Paid online",
            comment:
              `Authorize.net transaction ${verifiedPayment.transactionId}`,
            amount: {
              amount: expectedAmount.toFixed(2),
              currency: "USD",
            },
            paymentMethod: "creditCard",
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(
        "BOOKEO FINALIZE ERROR:",
        JSON.stringify(data, null, 2)
      );

      const orphan: OrphanPayment = {
        sessionId,
        transactionId: verifiedPayment.transactionId,
        amount: verifiedPayment.amount,
        holdId: session.holdId,
        productId: session.productId,
        eventId: session.eventId,
        players: session.players,
        location: session.location,
        date: session.date,
        time: session.time,
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email,
        phone: session.phone,
        bookeoError: data,
        createdAt: Date.now(),
        status: "needs_recovery",
        failureType: "bookeo_rejected",
      };

      await redis.set(
        `orphan-payment:${sessionId}`,
        orphan,
        {
          ex: 60 * 60 * 24 * 30,
        }
      );

      console.error(
        "ORPHAN PAYMENT SAVED (paid but not booked):",
        sessionId,
        verifiedPayment.transactionId
      );

      return NextResponse.json(
        {
          status: response.status,
          data,
        },
        { status: response.status }
      );
    }

    /*
     * Bookeo reported success.
     * Do not consider finalization complete unless
     * Bookeo actually supplied a booking ID.
     */
    const bookingNumber = String(data?.bookingNumber || "");

    if (!bookingNumber) {
      throw new Error(
        "Bookeo returned success but no booking number was present."
      );
    }

    /*
     * Record successful finalization.
     */
    await redis.set(
      `bookeo-finalized:${sessionId}`,
      {
        sessionId,
        bookingId: bookingNumber,
        transactionId: verifiedPayment.transactionId,
        finalizedAt: Date.now(),
      },
      {
        ex: 60 * 60 * 24 * 90,
      }
    );

    /*
     * A successful booking no longer needs orphan recovery.
     */
    await redis.del(`orphan-payment:${sessionId}`);

    return NextResponse.json({
      status: response.status,
      data,
    });
  } catch (error) {
    console.error("BOOKEO FINALIZE CRASH:", error);

    /*
     * If payment was verified but something unexpected
     * failed, preserve the booking information for
     * manual/reconciled recovery.
     */
    try {
      if (sessionId) {
        const verifiedPayment =
          await redis.get<VerifiedPayment>(
            `verified-payment:${sessionId}`
          );

        const session = await redis.get<BookingSession>(
          `booking-session:${sessionId}`
        );

        if (verifiedPayment && session) {
          const orphan: OrphanPayment = {
            sessionId,
            transactionId:
              verifiedPayment.transactionId,
            amount: verifiedPayment.amount,
            holdId: session.holdId,
            productId: session.productId,
            eventId: session.eventId,
            players: session.players,
            location: session.location,
            date: session.date,
            time: session.time,
            firstName: session.firstName,
            lastName: session.lastName,
            email: session.email,
            phone: session.phone,
            bookeoError: String(error),
            createdAt: Date.now(),
            status: "needs_recovery",
            failureType: "uncertain",
          };

          await redis.set(
            `orphan-payment:${sessionId}`,
            orphan,
            {
              ex: 60 * 60 * 24 * 30,
            }
          );

          console.error(
            "ORPHAN PAYMENT SAVED AFTER CRASH:",
            sessionId
          );
        }
      }
    } catch (recoveryError) {
      console.error(
        "FAILED TO SAVE ORPHAN AFTER CRASH:",
        recoveryError
      );
    }

    return NextResponse.json(
      {
        error: "Could not finalize booking.",
      },
      { status: 500 }
    );
  } finally {
    /*
     * Release only OUR lock.
     *
     * Checking the token prevents this request from
     * deleting a newer request's lock if our original
     * 120-second lock expired.
     */
    if (lockAcquired && sessionId && lockToken) {
      try {
        const lockKey =
          `bookeo-finalize-lock:${sessionId}`;

        const currentToken =
          await redis.get<string>(lockKey);

        if (currentToken === lockToken) {
          await redis.del(lockKey);
        }
      } catch (lockError) {
        console.error(
          "BOOKEO FINALIZE LOCK RELEASE ERROR:",
          lockError
        );
      }
    }
  }
}