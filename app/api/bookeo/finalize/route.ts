import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import { Resend } from "resend";
import {
  BOOKEO_PEOPLE_CATEGORY_ID,
  LOCATIONS,
} from "../../../data/locations";
import {
  type BookingSession,
  type VerifiedPayment,
  type OrphanPayment,
  type FinalizedBooking,
  isValidBookingSessionId,
} from "../../../lib/booking";

const redis = Redis.fromEnv();
const resend = new Resend(
  process.env.RESEND_API_KEY
);

const BOOKEO_KOP_API_KEY = process.env.BOOKEO_KOP_API_KEY;
const BOOKEO_CH_API_KEY = process.env.BOOKEO_CH_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

const BOOKEO_FINALIZE_TIMEOUT_MS = 15_000;

type PurchaseAnalytics = {
  transactionId: string;
  value: number;
  currency: "USD";
  productId: string;
  roomName: string;
  location: string;
  players: number;
};

function buildPurchaseAnalytics(
  session: BookingSession,
  transactionId: string,
  amount: string | number
): PurchaseAnalytics | null {
  const value =
    Number(amount);

  const players =
    Number(session.players);

  if (
    !transactionId ||
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isInteger(players) ||
    players <= 0
  ) {
    return null;
  }

  return {
    transactionId,
    value,
    currency: "USD",
    productId:
      session.productId,
    roomName:
      session.roomName,
    location:
      session.location,
    players,
  };
}

async function sendRecoveryAlert(
  orphan: OrphanPayment
) {
  const alertKey =
    `orphan-alert-sent:${orphan.sessionId}`;

  /*
   * Prevent repeated confirmation attempts from
   * sending duplicate staff alerts.
   */
  const claimed =
    await redis.set(
      alertKey,
      "1",
      {
        nx: true,
        ex:
          60 *
          60 *
          24 *
          30,
      }
    );

  if (claimed !== "OK") {
    return;
  }

  try {
    const { error } =
      await resend.emails.send({
        from:
          "Escape Room Mystery <info@escaperoommystery.com>",

        to: [
          "info@escaperoommystery.com",
        ],

        subject:
          `URGENT: Paid booking needs recovery - ${orphan.location}`,

        text: `
A customer payment was received, but the Bookeo booking was not safely confirmed.

ACTION REQUIRED:
Check the Booking Recovery administration page before taking any manual action.

Failure type: ${orphan.failureType}
Location: ${orphan.location}
Date: ${orphan.date}
Time: ${orphan.time}
Players: ${orphan.players}
Amount: $${orphan.amount}

Customer: ${orphan.firstName} ${orphan.lastName}
Email: ${orphan.email}
Phone: ${orphan.phone}

Authorize.Net transaction: ${orphan.transactionId}
Booking session: ${orphan.sessionId}
Bookeo hold: ${orphan.holdId}

IMPORTANT:
Do not manually create another Bookeo booking until the orphan has been reconciled.
        `.trim(),
      });

    if (error) {
      throw new Error(
        "Recovery alert email failed."
      );
    }
  } catch (error) {
    /*
     * Allow a later request to retry the alert
     * if email delivery itself failed.
     */
    await redis.del(alertKey);

    console.error(
      "Failed to send booking recovery alert.",
      {
        sessionId:
          orphan.sessionId,
        error:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );
  }
}
export async function POST(request: Request) {
  let sessionId = "";
  let lockToken = "";
  let lockAcquired = false;

  try {
    /*
     * Finalization is already strongly protected by
     * verified payment + idempotency + locking.
     *
     * This additional ceiling protects against abusive
     * repeated requests without interfering with a few
     * legitimate confirmation retries.
     */
    const forwardedFor =
      request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey =
      `rate-limit:bookeo-finalize:${ip}`;

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
            "Too many booking finalization attempts. Please wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

    const body = await request.json();

    sessionId = String(body.sessionId || "").trim();

    if (
      !isValidBookingSessionId(
        sessionId
      )
    ) {
      return NextResponse.json(
        {
          error: "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    /*
     * Never trust booking information from the browser.
     */
    const session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      return NextResponse.json(
        {
          error: "Booking session not found.",
        },
        { status: 404 }
      );
    }

    const BOOKEO_API_KEY =
      session.location ===
        LOCATIONS.cherryHill.slug
        ? BOOKEO_CH_API_KEY
        : session.location ===
          LOCATIONS.kingOfPrussia.slug
          ? BOOKEO_KOP_API_KEY
          : null;

    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        {
          error:
            "Missing or invalid Bookeo location/credentials.",
        },
        { status: 500 }
      );
    }

    /*
     * IDEMPOTENCY GATE
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
        purchase:
          buildPurchaseAnalytics(
            session,
            existingFinalization.transactionId,
            session.total
          ),
      });
    }

    /*
     * RECOVERY SAFETY GATE
     *
     * The payment webhook creates a
     * payment_received_pending_finalization orphan before
     * normal finalization. That state is allowed through.
     *
     * Once a Bookeo attempt has produced either an
     * uncertain result or an explicit Bookeo rejection,
     * never send another customer-triggered Bookeo POST.
     * Staff must reconcile the orphan first.
     */
    const existingOrphan =
      await redis.get<OrphanPayment>(
        `orphan-payment:${sessionId}`
      );

    if (
      existingOrphan &&
      existingOrphan.status ===
        "needs_recovery" &&
      existingOrphan.failureType !==
        "payment_received_pending_finalization"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment was received, but this booking requires staff reconciliation before any further Bookeo attempt.",
          recoveryRequired: true,
          retryable: false,
        },
        { status: 409 }
      );
    }

    /*
     * HARD PAYMENT SECURITY GATE
     */
    const verifiedPayment =
      await redis.get<VerifiedPayment>(
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

    const expectedAmount =
      Number(session.total);

    const verifiedAmount =
      Number(verifiedPayment.amount);

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
     * ATOMIC FINALIZATION LOCK
     */
    lockToken = crypto.randomUUID();

    const lockKey =
      `bookeo-finalize-lock:${sessionId}`;

    const lockResult =
      await redis.set(
        lockKey,
        lockToken,
        {
          nx: true,
          ex: 120,
        }
      );

    if (lockResult !== "OK") {
      return NextResponse.json(
        {
          error:
            "Booking finalization is already in progress.",
          retryable: true,
        },
        { status: 409 }
      );
    }

    lockAcquired = true;

    /*
     * Check again after acquiring the lock.
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
        purchase:
          buildPurchaseAnalytics(
            session,
            finalizedAfterLock.transactionId,
            session.total
          ),
      });
    }

    /*
     * Re-check the orphan state inside the lock so an
     * earlier finalization attempt cannot become uncertain
     * between the first safety check and this Bookeo POST.
     */
    const orphanAfterLock =
      await redis.get<OrphanPayment>(
        `orphan-payment:${sessionId}`
      );

    if (
      orphanAfterLock &&
      orphanAfterLock.status ===
        "needs_recovery" &&
      orphanAfterLock.failureType !==
        "payment_received_pending_finalization"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment was received, but this booking requires staff reconciliation before any further Bookeo attempt.",
          recoveryRequired: true,
          retryable: false,
        },
        { status: 409 }
      );
    }

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?previousHoldId=${encodeURIComponent(
        session.holdId
      )}`;

    /*
     * IMPORTANT:
     * A timeout here is NOT treated as a clean failure.
     *
     * Bookeo may have received and completed the request
     * even if our server stopped waiting for the response.
     * Therefore any thrown timeout enters the catch block
     * below and becomes an "uncertain" orphan requiring
     * reconciliation before recovery.
     */
    const response = await fetch(
      url,
      {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.timeout(
          BOOKEO_FINALIZE_TIMEOUT_MS
        ),
        headers: {
          "Content-Type": "application/json",
          "X-Bookeo-apiKey": BOOKEO_API_KEY,
          "X-Bookeo-secretKey": BOOKEO_SECRET_KEY,
        },
        body: JSON.stringify({
          productId: session.productId,
          eventId: session.eventId,

          participants: {
            numbers: [
              {
                peopleCategoryId:
                  BOOKEO_PEOPLE_CATEGORY_ID,
                number:
                  Number(session.players),
              },
            ],
          },

          customer: {
            firstName:
              session.firstName || "",
            lastName:
              session.lastName || "",
            emailAddress:
              session.email || "",
            phoneNumbers:
              session.phone
                ? [
                  {
                    number:
                      session.phone,
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
                amount:
                  expectedAmount.toFixed(2),
                currency: "USD",
              },
              paymentMethod: "creditCard",
            },
          ],
        }),
      }
    );

    const data =
      await response.json();

    /*
     * Bookeo explicitly responded with a rejection.
     *
     * This differs from a timeout/network crash because
     * here we know Bookeo returned a non-success result.
     */
    if (!response.ok) {
      const orphan: OrphanPayment = {
        sessionId,
        transactionId:
          verifiedPayment.transactionId,
        amount:
          verifiedPayment.amount,
        holdId:
          session.holdId,
        productId:
          session.productId,
        eventId:
          session.eventId,
        players:
          session.players,
        location:
          session.location,
        date:
          session.date,
        time:
          session.time,
        firstName:
          session.firstName,
        lastName:
          session.lastName,
        email:
          session.email,
        phone:
          session.phone,
        bookeoError: {
          status: response.status,
        },
        createdAt:
          Date.now(),
        status:
          "needs_recovery",
        failureType:
          "bookeo_rejected",
      };

      await redis.set(
        `orphan-payment:${sessionId}`,
        orphan,
        {
          ex:
            60 *
            60 *
            24 *
            30,
        }
      );

      await sendRecoveryAlert(
        orphan
      );

      console.error(
        "Paid booking requires recovery.",
        {
          sessionId,
          failureType:
            "bookeo_rejected",
          bookeoStatus:
            response.status,
        }
      );

      return NextResponse.json(
        {
          error:
            "Payment succeeded, but the booking could not be finalized automatically.",
          recoveryRequired:
            true,
          retryable:
            false,
        },
        {
          status: 502,
        }
      );
    }

    /*
     * Bookeo reported success.
     */
    const bookingNumber =
      String(
        data?.bookingNumber || ""
      );

    if (!bookingNumber) {
      throw new Error(
        "Bookeo returned success but no booking number was present."
      );
    }

    await redis.set(
      `bookeo-finalized:${sessionId}`,
      {
        sessionId,
        bookingId:
          bookingNumber,
        transactionId:
          verifiedPayment.transactionId,
        finalizedAt:
          Date.now(),
      },
      {
        ex:
          60 *
          60 *
          24 *
          90,
      }
    );

    await redis.del(
      `orphan-payment:${sessionId}`
    );

    return NextResponse.json({
      status:
        response.status,
      data,
      purchase:
        buildPurchaseAnalytics(
          session,
          verifiedPayment.transactionId,
          verifiedPayment.amount
        ),
    });
  } catch (error) {
    /*
     * This includes:
     * - Bookeo timeout
     * - network interruption
     * - malformed response
     * - unexpected server failure
     *
     * Since payment may already have succeeded and the
     * Bookeo outcome may be unknown, preserve it as an
     * UNCERTAIN orphan. Do not retry Bookeo blindly.
     */
    console.error(
      "Bookeo finalization became uncertain.",
      {
        sessionId:
          sessionId || null,
        error:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );

    try {
      if (sessionId) {
        const verifiedPayment =
          await redis.get<VerifiedPayment>(
            `verified-payment:${sessionId}`
          );

        const session =
          await redis.get<BookingSession>(
            `booking-session:${sessionId}`
          );

        if (
          verifiedPayment &&
          session
        ) {
          const orphan: OrphanPayment = {
            sessionId,
            transactionId:
              verifiedPayment.transactionId,
            amount:
              verifiedPayment.amount,
            holdId:
              session.holdId,
            productId:
              session.productId,
            eventId:
              session.eventId,
            players:
              session.players,
            location:
              session.location,
            date:
              session.date,
            time:
              session.time,
            firstName:
              session.firstName,
            lastName:
              session.lastName,
            email:
              session.email,
            phone:
              session.phone,
            bookeoError: {
              errorType:
                error instanceof Error
                  ? error.name
                  : "unknown",
            },
            createdAt:
              Date.now(),
            status:
              "needs_recovery",
            failureType:
              "uncertain",
          };

          await redis.set(
            `orphan-payment:${sessionId}`,
            orphan,
            {
              ex:
                60 *
                60 *
                24 *
                30,
            }
          );

          await sendRecoveryAlert(
            orphan
          );

          console.error(
            "Paid booking saved for reconciliation.",
            {
              sessionId,
              failureType:
                "uncertain",
            }
          );
        }
      }
    } catch (recoveryError) {
      console.error(
        "Failed to preserve paid booking for recovery.",
        {
          sessionId:
            sessionId || null,
          error:
            recoveryError instanceof Error
              ? recoveryError.name
              : "unknown",
        }
      );
    }

    return NextResponse.json(
      {
        error:
          "Could not safely confirm the booking. Recovery may be required.",
        recoveryRequired:
          true,
        retryable:
          false,
      },
      { status: 500 }
    );
  } finally {
    /*
     * Release only our own lock.
     */
    if (
      lockAcquired &&
      sessionId &&
      lockToken
    ) {
      try {
        const lockKey =
          `bookeo-finalize-lock:${sessionId}`;

        const currentToken =
          await redis.get<string>(
            lockKey
          );

        if (
          currentToken ===
          lockToken
        ) {
          await redis.del(
            lockKey
          );
        }
      } catch (lockError) {
        console.error(
          "Bookeo finalize lock release failed.",
          {
            sessionId,
            error:
              lockError instanceof Error
                ? lockError.name
                : "unknown",
          }
        );
      }
    }
  }
}
