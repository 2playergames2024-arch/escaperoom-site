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

const EXTERNAL_REQUEST_TIMEOUT_MS = 15_000;

function isTimeoutError(
  error: unknown
) {
  return (
    error instanceof Error &&
    (
      error.name === "TimeoutError" ||
      error.name === "AbortError"
    )
  );
}

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
  lastReconciliationResult?:
  | "no_match"
  | "ambiguous";
  lastReconciledAt?: number;
};

type BookeoBooking = {
  bookingNumber?: string;
  eventId?: string;
  productId?: string;
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
    };
  };
};

export async function POST(
  request: Request
) {
  let lockKey = "";
  let lockToken = "";
  let lockAcquired = false;

  try {
    /*
     * Protect this high-impact administrative endpoint
     * from unlimited attempts.
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
      `rate-limit:admin-recover:${ip}`;

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

    if (
      request.headers.get(
        "x-admin-secret"
      ) !== adminSecret
    ) {
      return NextResponse.json(
        {
          error: "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const loginId =
      process.env.AUTHORIZE_LOGIN_ID;

    const transactionKey =
      process.env.AUTHORIZE_TRANSACTION_KEY;

    const authorizeEnvironment =
      process.env.AUTHORIZE_ENVIRONMENT ||
      "production";

    if (
      !loginId ||
      !transactionKey
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.net credentials are missing.",
        },
        { status: 500 }
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

    if (
      orphan.status !==
      "needs_recovery"
    ) {
      return NextResponse.json(
        {
          error:
            "This orphan is not awaiting recovery.",
        },
        { status: 409 }
      );
    }

    /*
     * Recovery can only occur after reconciliation
     * explicitly found zero matching bookings.
     */
    if (
      orphan.lastReconciliationResult !==
      "no_match" ||
      !orphan.lastReconciledAt
    ) {
      return NextResponse.json(
        {
          error:
            "Run reconciliation successfully before recovery.",
        },
        { status: 409 }
      );
    }

    /*
     * Require a fresh reconciliation.
     */
    const reconciliationAge =
      Date.now() -
      orphan.lastReconciledAt;

    if (
      reconciliationAge >
      5 * 60 * 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Reconciliation result is too old. Reconcile again before recovery.",
        },
        { status: 409 }
      );
    }

    const existingFinalization =
      await redis.get(
        `bookeo-finalized:${sessionId}`
      );

    if (
      existingFinalization
    ) {
      return NextResponse.json({
        result:
          "already_finalized",
      });
    }

    /*
     * Atomic recovery lock.
     */
    lockKey =
      `bookeo-recovery-lock:${sessionId}`;

    lockToken =
      crypto.randomUUID();

    const lockResult =
      await redis.set(
        lockKey,
        lockToken,
        {
          nx: true,
          ex: 120,
        }
      );

    if (
      lockResult !== "OK"
    ) {
      return NextResponse.json(
        {
          error:
            "Recovery is already in progress.",
        },
        { status: 409 }
      );
    }

    lockAcquired = true;

    const finalizedAfterLock =
      await redis.get(
        `bookeo-finalized:${sessionId}`
      );

    if (
      finalizedAfterLock
    ) {
      return NextResponse.json({
        result:
          "already_finalized",
      });
    }

    /*
     * FRESH AUTHORIZE.NET VERIFICATION
     */
    const authorizeApiUrl =
      authorizeEnvironment ===
        "sandbox"
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    let authorizeResponse: Response;

    try {
      authorizeResponse =
        await fetch(
          authorizeApiUrl,
          {
            method: "POST",
            signal:
              AbortSignal.timeout(
                EXTERNAL_REQUEST_TIMEOUT_MS
              ),
            headers: {
              "Content-Type":
                "application/json",
            },
            cache: "no-store",
            body:
              JSON.stringify({
                getTransactionDetailsRequest:
                {
                  merchantAuthentication:
                  {
                    name:
                      loginId,
                    transactionKey,
                  },

                  transId:
                    orphan.transactionId,
                },
              }),
          }
        );
    } catch (error) {
      console.error(
        "Authorize.Net recovery verification request failed.",
        {
          sessionId,
          reason:
            isTimeoutError(
              error
            )
              ? "timeout"
              : "request_error",
        }
      );

      return NextResponse.json(
        {
          error:
            isTimeoutError(error)
              ? "Authorize.net took too long to respond during recovery verification."
              : "Authorize.net could not be reached during recovery verification.",
        },
        {
          status:
            isTimeoutError(error)
              ? 504
              : 502,
        }
      );
    }

    const authorizeData =
      await authorizeResponse.json();

    if (
      !authorizeResponse.ok ||
      authorizeData?.messages
        ?.resultCode !== "Ok" ||
      !authorizeData
        ?.transaction
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.net transaction could not be re-verified.",
        },
        { status: 409 }
      );
    }

    const transaction =
      authorizeData.transaction;

    const expectedAmount =
      Number(orphan.amount);

    const actualAmount =
      Number(
        transaction.authAmount
      );

    const amountMatches =
      Number.isFinite(
        expectedAmount
      ) &&
      Number.isFinite(
        actualAmount
      ) &&
      Math.abs(
        expectedAmount -
        actualAmount
      ) < 0.001;

    const transactionStatus =
      String(
        transaction.transactionStatus ||
        ""
      );

    const statusIsValid = [
      "capturedPendingSettlement",
      "settledSuccessfully",
    ].includes(
      transactionStatus
    );

    if (
      !amountMatches ||
      !statusIsValid
    ) {
      console.error(
        "Recovery payment verification failed.",
        {
          sessionId,
          amountMatches,
          transactionStatus,
        }
      );

      return NextResponse.json(
        {
          error:
            "Authorize.net payment did not pass recovery verification.",
        },
        { status: 403 }
      );
    }

    /*
     * CHECK BOOKEO AGAIN INSIDE THE LOCK
     */
    const {
      startTime,
      endTime,
    } =
      getEasternDayBounds(
        orphan.date
      );

    const lookupUrl =
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

    let bookingPages: {
      ok: boolean;
      status: number;
      bookings: BookeoBooking[];
    };

    try {
      bookingPages =
        await fetchAllBookeoBookingPages<BookeoBooking>(
          lookupUrl,
          BOOKEO_API_KEY,
          BOOKEO_SECRET_KEY,
          EXTERNAL_REQUEST_TIMEOUT_MS
        );
    } catch (error) {
      console.error(
        "Bookeo pre-recovery lookup failed.",
        {
          sessionId,
          reason:
            isTimeoutError(
              error
            )
              ? "timeout"
              : "request_error",
        }
      );

      return NextResponse.json(
        {
          error:
            isTimeoutError(error)
              ? "Bookeo took too long to respond before recovery. No booking was created."
              : "Bookeo could not be checked before recovery. No booking was created.",
        },
        {
          status:
            isTimeoutError(error)
              ? 504
              : 502,
        }
      );
    }

    if (!bookingPages.ok) {
      return NextResponse.json(
        {
          error:
            "Bookeo could not be checked across all result pages immediately before recovery. No booking was created.",
          bookeoStatus:
            bookingPages.status,
        },
        { status: 502 }
      );
    }

    const bookings =
      bookingPages.bookings;

    const orphanPlayers =
      Number(
        orphan.players
      );

    const existingMatches =
      bookings.filter(
        (booking) => {
          if (
            booking.productId !==
            orphan.productId ||
            booking.eventId !==
            orphan.eventId ||
            booking.canceled ===
            true
          ) {
            return false;
          }

          const participants =
            booking.participants
              ?.numbers?.find(
                (
                  participant
                ) =>
                  participant.peopleCategoryId ===
                  BOOKEO_PEOPLE_CATEGORY_ID
              )?.number;

          const paidAmount =
            Number(
              booking.price
                ?.totalPaid
                ?.amount
            );

          return (
            Number.isFinite(
              participants
            ) &&
            participants ===
            orphanPlayers &&
            Number.isFinite(
              paidAmount
            ) &&
            Math.abs(
              paidAmount -
              expectedAmount
            ) < 0.001
          );
        }
      );

    if (
      existingMatches.length >
      0
    ) {
      /*
       * A matching booking appeared after
       * reconciliation. Never create a duplicate.
       */
      if (
        existingMatches.length ===
        1
      ) {
        const existingBookingNumber =
          String(
            existingMatches[0]
              .bookingNumber ||
            ""
          );

        if (
          !existingBookingNumber
        ) {
          return NextResponse.json(
            {
              result:
                "manual_review_required",
              error:
                "A matching Bookeo booking exists but has no booking number.",
            },
            { status: 409 }
          );
        }

        await redis.set(
          `bookeo-finalized:${sessionId}`,
          {
            sessionId,
            bookingId:
              existingBookingNumber,
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
              existingBookingNumber,
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
          bookingNumber:
            existingBookingNumber,
        });
      }

      return NextResponse.json(
        {
          result:
            "manual_review_required",
          error:
            "Multiple matching Bookeo bookings exist. Recovery stopped to prevent a duplicate booking.",
          matches:
            existingMatches.length,
        },
        { status: 409 }
      );
    }

    /*
     * CREATE THE RECOVERY BOOKING
     *
     * IMPORTANT:
     * Once this POST is sent, a timeout/network failure
     * creates an UNCERTAIN outcome. Bookeo may have
     * created the booking even if we never received
     * the response.
     *
     * Therefore we invalidate the previous
     * reconciliation result before allowing any
     * future recovery attempt.
     */
    const createUrl =
      "https://api.bookeo.com/v2/bookings";

    let bookeoResponse: Response;

    try {
      bookeoResponse =
        await fetch(
          createUrl,
          {
            method: "POST",
            cache: "no-store",
            signal:
              AbortSignal.timeout(
                EXTERNAL_REQUEST_TIMEOUT_MS
              ),
            headers: {
              "Content-Type":
                "application/json",
              "X-Bookeo-apiKey":
                BOOKEO_API_KEY,
              "X-Bookeo-secretKey":
                BOOKEO_SECRET_KEY,
            },
            body:
              JSON.stringify({
                productId:
                  orphan.productId,

                eventId:
                  orphan.eventId,

                participants: {
                  numbers: [
                    {
                      peopleCategoryId:
                        BOOKEO_PEOPLE_CATEGORY_ID,
                      number:
                        Number(
                          orphan.players
                        ),
                    },
                  ],
                },

                customer: {
                  firstName:
                    orphan.firstName ||
                    "",
                  lastName:
                    orphan.lastName ||
                    "",
                  emailAddress:
                    orphan.email ||
                    "",
                  phoneNumbers:
                    orphan.phone
                      ? [
                        {
                          number:
                            orphan.phone,
                          type:
                            "mobile",
                        },
                      ]
                      : [],
                },

                initialPayments: [
                  {
                    reason:
                      "Paid online - recovered booking",

                    comment:
                      `Recovered from Authorize.net transaction ${orphan.transactionId}`,

                    amount: {
                      amount:
                        expectedAmount.toFixed(
                          2
                        ),
                      currency:
                        "USD",
                    },

                    paymentMethod:
                      "creditCard",
                  },
                ],
              }),
          }
        );
    } catch (error) {
      /*
       * Do NOT allow another recovery attempt using
       * the old "no_match" reconciliation.
       *
       * Bookeo may have created the booking before
       * this request timed out.
       */
      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,

          bookeoError: {
            stage:
              "recovery_create",
            outcome:
              "uncertain",
            reason:
              isTimeoutError(
                error
              )
                ? "timeout"
                : "request_error",
          },

          lastRecoveryAttemptAt:
            Date.now(),

          /*
           * Setting this to zero deliberately causes
           * the recovery precondition to fail until
           * reconciliation is run again.
           */
          lastReconciledAt:
            0,
        },
        {
          ex:
            60 *
            60 *
            24 *
            30,
        }
      );

      console.error(
        "Bookeo recovery creation outcome is uncertain.",
        {
          sessionId,
          reason:
            isTimeoutError(
              error
            )
              ? "timeout"
              : "request_error",
        }
      );

      return NextResponse.json(
        {
          error:
            "The recovery booking could not be safely confirmed. Reconcile this payment again before attempting recovery.",
          reconciliationRequired:
            true,
        },
        {
          status:
            isTimeoutError(error)
              ? 504
              : 502,
        }
      );
    }

    const bookeoData =
      await bookeoResponse.json();

    if (
      !bookeoResponse.ok
    ) {
      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,

          bookeoError: {
            stage:
              "recovery_create",
            status:
              bookeoResponse.status,
          },

          lastRecoveryAttemptAt:
            Date.now(),

          /*
           * Require reconciliation again before
           * another create attempt.
           */
          lastReconciledAt:
            0,
        },
        {
          ex:
            60 *
            60 *
            24 *
            30,
        }
      );

      return NextResponse.json(
        {
          error:
            "Bookeo recovery booking failed. Reconcile again before another recovery attempt.",
          bookeoStatus:
            bookeoResponse.status,
          reconciliationRequired:
            true,
        },
        { status: 502 }
      );
    }

    const bookingNumber =
      String(
        bookeoData
          ?.bookingNumber ||
        ""
      );

    /*
     * Even an HTTP success without a booking number
     * is treated as uncertain. Do not automatically
     * create another booking.
     */
    if (
      !bookingNumber
    ) {
      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,

          bookeoError: {
            stage:
              "recovery_create",
            outcome:
              "uncertain",
            reason:
              "success_without_booking_number",
          },

          lastRecoveryAttemptAt:
            Date.now(),

          lastReconciledAt:
            0,
        },
        {
          ex:
            60 *
            60 *
            24 *
            30,
        }
      );

      return NextResponse.json(
        {
          error:
            "Bookeo responded to the recovery request but the booking could not be safely confirmed. Reconcile again before attempting recovery.",
          reconciliationRequired:
            true,
        },
        { status: 500 }
      );
    }

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
        recovered:
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
          "recovered",
        recoveredBookingNumber:
          bookingNumber,
        recoveredAt:
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
        "recovered",
      sessionId,
      bookingNumber,
    });
  } catch (error) {
    console.error(
      "Orphan recovery request failed.",
      {
        reason:
          isTimeoutError(
            error
          )
            ? "timeout"
            : error instanceof Error
              ? error.name
              : "unknown",
      }
    );

    return NextResponse.json(
      {
        error:
          "Could not recover orphan payment.",
      },
      { status: 500 }
    );
  } finally {
    if (
      lockAcquired &&
      lockKey &&
      lockToken
    ) {
      try {
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
      } catch (error) {
        console.error(
          "Recovery lock release failed.",
          {
            reason:
              error instanceof Error
                ? error.name
                : "unknown",
          }
        );
      }
    }
  }
}