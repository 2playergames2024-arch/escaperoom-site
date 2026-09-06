import { Redis } from "@upstash/redis";
import { Resend } from "resend";

import {
  BOOKEO_PEOPLE_CATEGORY_ID,
  LOCATIONS,
} from "../data/locations";

import {
  type BookingSession,
  type PaymentAttempt,
  type VerifiedPayment,
  type AuthorizeEvent,
  type OrphanPayment,
  type FinalizedBooking,
} from "./booking";

const redis = Redis.fromEnv();

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const AUTHORIZE_VERIFY_TIMEOUT_MS = 15_000;
const BOOKEO_FINALIZE_TIMEOUT_MS = 15_000;

const PAYMENT_STATE_TTL_SECONDS =
  60 * 60 * 24 * 30;

const FINALIZED_BOOKING_TTL_SECONDS =
  60 * 60 * 24 * 90;

type PurchaseAnalytics = {
  transactionId: string;
  value: number;
  currency: "USD";
  productId: string;
  roomName: string;
  location: string;
  players: number;
};

export type VerifyPaymentResult =
  | {
    ok: true;
    verifiedPayment: VerifiedPayment;
  }
  | {
    ok: false;
    pending?: boolean;
    error: string;
  };

export type FinalizeBookingResult =
  | {
    ok: true;
    bookingId: string;
    alreadyFinalized?: boolean;
    purchase: PurchaseAnalytics | null;
  }
  | {
    ok: false;
    recoveryRequired?: boolean;
    retryable?: boolean;
    status: number;
    error: string;
  };

export type CompletePaidBookingResult =
  | {
    ok: true;
    bookingId: string;
    alreadyFinalized?: boolean;
    purchase: PurchaseAnalytics | null;
  }
  | {
    ok: false;
    pending?: boolean;
    recoveryRequired?: boolean;
    retryable?: boolean;
    status: number;
    error: string;
  };

async function loadBookingSession(
  sessionId: string
): Promise<BookingSession | null> {
  const session =
    await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

  if (session) {
    return session;
  }

  /*
   * The durable payment-attempt snapshot survives longer
   * than the normal booking session. This lets payment
   * completion continue even if the customer's browser
   * never returns promptly.
   */
  const paymentAttempt =
    await redis.get<PaymentAttempt>(
      `payment-attempt:${sessionId}`
    );

  if (
    paymentAttempt?.session?.sessionId ===
    sessionId
  ) {
    return paymentAttempt.session;
  }

  return null;
}

function buildPurchaseAnalytics(
  session: BookingSession,
  transactionId: string,
  amount: string | number
): PurchaseAnalytics | null {
  const value = Number(amount);
  const players = Number(session.players);

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
    productId: session.productId,
    roomName: session.roomName,
    location: session.location,
    players,
  };
}

async function sendRecoveryAlert(
  orphan: OrphanPayment
) {
  const alertKey =
    `orphan-alert-sent:${orphan.sessionId}`;

  const claimed =
    await redis.set(
      alertKey,
      "1",
      {
        nx: true,
        ex: PAYMENT_STATE_TTL_SECONDS,
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
    await redis.del(alertKey);

    console.error(
      "Failed to send booking recovery alert.",
      {
        sessionId: orphan.sessionId,
        error:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );
  }
}

export async function verifyAuthorizePaymentForSession(
  sessionId: string
): Promise<VerifyPaymentResult> {
  const loginId =
    process.env.AUTHORIZE_LOGIN_ID;

  const transactionKey =
    process.env.AUTHORIZE_TRANSACTION_KEY;

  const environment =
    process.env.AUTHORIZE_ENVIRONMENT ||
    "production";

  if (!loginId || !transactionKey) {
    return {
      ok: false,
      error:
        "Authorize.net credentials are missing.",
    };
  }

  const session =
    await loadBookingSession(sessionId);

  if (!session) {
    return {
      ok: false,
      error:
        "Booking session not found.",
    };
  }

  /*
   * IDEMPOTENT FAST PATH
   */
  const existingVerification =
    await redis.get<VerifiedPayment>(
      `verified-payment:${sessionId}`
    );

  if (
    existingVerification?.sessionId ===
    sessionId
  ) {
    return {
      ok: true,
      verifiedPayment:
        existingVerification,
    };
  }

  const apiUrl =
    environment === "sandbox"
      ? "https://apitest.authorize.net/xml/v1/request.api"
      : "https://api.authorize.net/xml/v1/request.api";

  let authorizeEvent =
    await redis.get<AuthorizeEvent>(
      `authorize-event:${sessionId}`
    );

  /*
   * FALLBACK:
   * If the webhook never arrived, look for the
   * transaction directly in Authorize.Net using
   * the invoice number we saved with the payment attempt.
   */
  if (!authorizeEvent?.transactionId) {
    const paymentAttempt =
      await redis.get<PaymentAttempt>(
        `payment-attempt:${sessionId}`
      );

    const invoiceNumber =
      paymentAttempt?.invoiceNumber;

    if (!invoiceNumber) {
      return {
        ok: false,
        pending: true,
        error:
          "Payment notification has not arrived yet.",
      };
    }

    try {
      const discoveryResponse =
        await fetch(
          apiUrl,
          {
            method: "POST",

            signal:
              AbortSignal.timeout(
                AUTHORIZE_VERIFY_TIMEOUT_MS
              ),

            headers: {
              "Content-Type":
                "application/json",
            },

            cache: "no-store",

            body:
              JSON.stringify({
                getUnsettledTransactionListRequest: {
                  merchantAuthentication: {
                    name: loginId,
                    transactionKey,
                  },

                  sorting: {
                    orderBy:
                      "submitTimeUTC",
                    orderDescending:
                      true,
                  },

                  paging: {
                    limit: 100,
                    offset: 1,
                  },
                },
              }),
          }
        );

      const discoveryData =
        await discoveryResponse.json();

      if (
        discoveryResponse.ok &&
        discoveryData?.messages
          ?.resultCode === "Ok" &&
        Array.isArray(
          discoveryData.transactions
        )
      ) {
        const matchingTransaction =
          discoveryData.transactions.find(
            (transaction: {
              invoiceNumber?: string;
              transId?: string;
            }) =>
              String(
                transaction.invoiceNumber ||
                ""
              ) === invoiceNumber &&
              Boolean(
                transaction.transId
              )
          );

        if (
          matchingTransaction?.transId
        ) {
          authorizeEvent = {
            eventType:
              "recovered_without_webhook",

            transactionId:
              String(
                matchingTransaction.transId
              ),

            sessionId,

            receivedAt:
              Date.now(),
          };

          await redis.set(
            `authorize-event:${sessionId}`,
            authorizeEvent,
            {
              ex:
                PAYMENT_STATE_TTL_SECONDS,
            }
          );

          console.warn(
            "Authorize.Net payment discovered without webhook.",
            {
              sessionId,
              invoiceNumber,
              transactionId:
                authorizeEvent.transactionId,
            }
          );
        }
      }
    } catch (error) {
      console.error(
        "Authorize.Net missing-webhook lookup failed.",
        {
          sessionId,
          reason:
            error instanceof Error
              ? error.name
              : "unknown",
        }
      );
    }

    if (!authorizeEvent?.transactionId) {
      return {
        ok: false,
        pending: true,
        error:
          "Payment has not been located yet.",
      };
    }
  }

  if (
    authorizeEvent.sessionId !==
    sessionId
  ) {
    return {
      ok: false,
      error:
        "Payment notification does not match this booking.",
    };
  }

  const authorizeVerifyStartedAt =
    Date.now();

  console.info(
    "BOOKING_TIMELINE",
    {
      stage:
        "authorize_verify_started",

      sessionId,

      transactionId:
        authorizeEvent.transactionId,

      occurredAt:
        new Date(
          authorizeVerifyStartedAt
        ).toISOString(),
    }
  );

  const payload = {
    getTransactionDetailsRequest: {
      merchantAuthentication: {
        name: loginId,
        transactionKey,
      },

      transId:
        authorizeEvent.transactionId,
    },
  };

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",

          signal:
            AbortSignal.timeout(
              AUTHORIZE_VERIFY_TIMEOUT_MS
            ),

          headers: {
            "Content-Type":
              "application/json",
          },

          cache: "no-store",

          body:
            JSON.stringify(payload),
        }
      );

    const data =
      await response.json();

    const authorizeVerifyCompletedAt =
      Date.now();

    console.info(
      "BOOKING_TIMELINE",
      {
        stage:
          "authorize_verify_response",

        sessionId,

        transactionId:
          authorizeEvent.transactionId,

        occurredAt:
          new Date(
            authorizeVerifyCompletedAt
          ).toISOString(),

        durationMs:
          authorizeVerifyCompletedAt -
          authorizeVerifyStartedAt,

        authorizeHttpStatus:
          response.status,

        authorizeResultCode:
          String(
            data?.messages?.resultCode || ""
          ),

        transactionStatus:
          String(
            data?.transaction
              ?.transactionStatus || ""
          ),
      }
    );

    if (
      !response.ok ||
      data?.messages?.resultCode !==
      "Ok" ||
      !data?.transaction
    ) {
      console.error(
        "Authorize.Net transaction verification rejected.",
        {
          sessionId,
          status: response.status,
        }
      );

      return {
        ok: false,
        error:
          "Authorize.net transaction could not be verified.",
      };
    }

    const transaction =
      data.transaction;

    const expectedAmount =
      Number(session.total);

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

    const acceptableStatuses = [
      "capturedPendingSettlement",
      "settledSuccessfully",
    ];

    const transactionStatus =
      String(
        transaction.transactionStatus ||
        ""
      );

    const statusIsValid =
      acceptableStatuses.includes(
        transactionStatus
      );

    if (
      !amountMatches ||
      !statusIsValid
    ) {
      console.error(
        "Payment verification failed.",
        {
          sessionId,
          amountMatches,
          transactionStatus,
        }
      );

      return {
        ok: false,
        error:
          "Payment did not pass verification.",
      };
    }

    const verifiedPayment:
      VerifiedPayment = {
      sessionId,

      transactionId:
        authorizeEvent.transactionId,

      amount:
        actualAmount.toFixed(2),

      transactionStatus,

      verifiedAt:
        Date.now(),
    };

    await redis.set(
      `verified-payment:${sessionId}`,
      verifiedPayment,
      {
        ex:
          PAYMENT_STATE_TTL_SECONDS,
      }
    );

    return {
      ok: true,
      verifiedPayment,
    };
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
      "Authorize.Net payment verification request failed.",
      {
        sessionId,
        reason:
          isTimeout
            ? "timeout"
            : "request_error",
      }
    );

    return {
      ok: false,
      error:
        isTimeout
          ? "The payment service took too long to respond."
          : "Payment verification failed.",
    };
  }
}

export async function finalizeBookeoBookingForSession(
  sessionId: string,
  trustedPayment?: {
    sessionId: string;
    transactionId: string;
    amount: string;
  }
): Promise<FinalizeBookingResult> {
  let lockToken = "";
  let lockAcquired = false;

  try {
    const session =
      await loadBookingSession(
        sessionId
      );

    if (!session) {
      return {
        ok: false,
        status: 404,
        error:
          "Booking session not found.",
      };
    }

    const BOOKEO_API_KEY =
      session.location ===
        LOCATIONS.cherryHill.slug
        ? process.env
          .BOOKEO_CH_API_KEY
        : session.location ===
          LOCATIONS.kingOfPrussia.slug
          ? process.env
            .BOOKEO_KOP_API_KEY
          : null;

    const BOOKEO_SECRET_KEY =
      process.env.BOOKEO_SECRET_KEY;

    if (
      !BOOKEO_API_KEY ||
      !BOOKEO_SECRET_KEY
    ) {
      return {
        ok: false,
        status: 500,
        error:
          "Missing or invalid Bookeo location/credentials.",
      };
    }

    /*
     * IDEMPOTENCY GATE
     */
    const existingFinalization =
      await redis.get<FinalizedBooking>(
        `bookeo-finalized:${sessionId}`
      );

    if (existingFinalization) {
      return {
        ok: true,

        bookingId:
          existingFinalization.bookingId,

        alreadyFinalized: true,

        purchase:
          buildPurchaseAnalytics(
            session,
            existingFinalization.transactionId,
            session.total
          ),
      };
    }

    /*
     * RECOVERY SAFETY GATE
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
      return {
        ok: false,
        status: 409,
        recoveryRequired: true,
        retryable: false,

        error:
          "Payment was received, but this booking requires staff reconciliation before any further Bookeo attempt.",
      };
    }

    /*
 * PAYMENT GATE
 *
 * A valid signed Authorize.Net webhook may supply the
 * trusted transaction directly so Bookeo does not depend
 * on the secondary getTransactionDetails request.
 *
 * The verified-payment record remains supported for
 * recovery and audit paths.
 */
    const verifiedPayment =
      trustedPayment ??
      await redis.get<VerifiedPayment>(
        `verified-payment:${sessionId}`
      );

    if (!verifiedPayment) {
      return {
        ok: false,
        status: 403,
        error:
          "No trusted payment record is available for this booking.",
      };
    }

    const expectedAmount =
      Number(session.total);

    const verifiedAmount =
      Number(
        verifiedPayment.amount
      );

    if (
      verifiedPayment.sessionId !==
      sessionId ||
      !Number.isFinite(
        expectedAmount
      ) ||
      !Number.isFinite(
        verifiedAmount
      ) ||
      Math.abs(
        expectedAmount -
        verifiedAmount
      ) >= 0.001
    ) {
      return {
        ok: false,
        status: 403,
        error:
          "Verified payment does not match this booking.",
      };
    }

    /*
     * ATOMIC FINALIZATION LOCK
     */
    lockToken =
      crypto.randomUUID();

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
      return {
        ok: false,
        status: 409,
        retryable: true,
        error:
          "Booking finalization is already in progress.",
      };
    }

    lockAcquired = true;

    /*
     * Check again after acquiring lock.
     */
    const finalizedAfterLock =
      await redis.get<FinalizedBooking>(
        `bookeo-finalized:${sessionId}`
      );

    if (finalizedAfterLock) {
      return {
        ok: true,

        bookingId:
          finalizedAfterLock.bookingId,

        alreadyFinalized: true,

        purchase:
          buildPurchaseAnalytics(
            session,
            finalizedAfterLock.transactionId,
            session.total
          ),
      };
    }

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
      return {
        ok: false,
        status: 409,
        recoveryRequired: true,
        retryable: false,

        error:
          "Payment was received, but this booking requires staff reconciliation before any further Bookeo attempt.",
      };
    }

    const bookeoFinalizeStartedAt =
      Date.now();

    const holdExpirationMs =
      new Date(
        session.holdExpiration
      ).getTime();

    console.info(
      "BOOKING_TIMELINE",
      {
        stage:
          "bookeo_finalize_started",

        sessionId,

        transactionId:
          verifiedPayment.transactionId,

        holdId:
          session.holdId,

        holdExpiration:
          session.holdExpiration,

        occurredAt:
          new Date(
            bookeoFinalizeStartedAt
          ).toISOString(),

        millisecondsUntilHoldExpiration:
          Number.isFinite(
            holdExpirationMs
          )
            ? holdExpirationMs -
            bookeoFinalizeStartedAt
            : null,

        holdAlreadyExpired:
          Number.isFinite(
            holdExpirationMs
          )
            ? bookeoFinalizeStartedAt >=
            holdExpirationMs
            : null,
      }
    );

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?previousHoldId=${encodeURIComponent(
        session.holdId
      )}` +
      `&notifyUsers=true` +
      `&notifyCustomer=true`;

    const response =
      await fetch(
        url,
        {
          method: "POST",
          cache: "no-store",

          signal:
            AbortSignal.timeout(
              BOOKEO_FINALIZE_TIMEOUT_MS
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
                session.productId,

              eventId:
                session.eventId,

              participants: {
                numbers: [
                  {
                    peopleCategoryId:
                      BOOKEO_PEOPLE_CATEGORY_ID,

                    number:
                      Number(
                        session.players
                      ),
                  },
                ],
              },

              customer: {
                firstName:
                  session.firstName ||
                  "",

                lastName:
                  session.lastName ||
                  "",

                emailAddress:
                  session.email ||
                  "",

                phoneNumbers:
                  session.phone
                    ? [
                      {
                        number:
                          session.phone,

                        type:
                          "mobile",
                      },
                    ]
                    : [],
              },

              initialPayments: [
                {
                  reason:
                    "Paid online",

                  comment:
                    `Authorize.net transaction ${verifiedPayment.transactionId}`,

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

    const data =
      await response.json();

    const bookeoResponseAt =
      Date.now();

    console.info(
      "BOOKING_TIMELINE",
      {
        stage:
          "bookeo_finalize_response",

        sessionId,

        transactionId:
          verifiedPayment.transactionId,

        occurredAt:
          new Date(
            bookeoResponseAt
          ).toISOString(),

        durationMs:
          bookeoResponseAt -
          bookeoFinalizeStartedAt,

        bookeoStatus:
          response.status,

        bookeoMessage:
          typeof data?.message === "string"
            ? data.message
            : null,

        bookeoErrorId:
          data?.errorId != null
            ? String(data.errorId)
            : null,
      }
    );

    /*
     * Bookeo explicitly rejected the booking.
     */
    if (!response.ok) {
      const orphan:
        OrphanPayment = {
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
          status:
            response.status,
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
            PAYMENT_STATE_TTL_SECONDS,
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

          bookeoMessage:
            typeof data?.message === "string"
              ? data.message
              : null,

          bookeoErrorId:
            data?.errorId != null
              ? String(data.errorId)
              : null,
        }
      );

      return {
        ok: false,
        status: 502,
        recoveryRequired: true,
        retryable: false,

        error:
          "Payment succeeded, but the booking could not be finalized automatically.",
      };
    }

    const bookingNumber =
      String(
        data?.bookingNumber ||
        ""
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
          FINALIZED_BOOKING_TTL_SECONDS,
      }
    );

    await redis.del(
      `orphan-payment:${sessionId}`
    );

    return {
      ok: true,

      bookingId:
        bookingNumber,

      purchase:
        buildPurchaseAnalytics(
          session,
          verifiedPayment.transactionId,
          verifiedPayment.amount
        ),
    };
  } catch (error) {
    console.error(
      "Bookeo finalization became uncertain.",
      {
        sessionId,

        error:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );

    try {
      const verifiedPayment =
        await redis.get<VerifiedPayment>(
          `verified-payment:${sessionId}`
        );

      const session =
        await loadBookingSession(
          sessionId
        );

      if (
        verifiedPayment &&
        session
      ) {
        const orphan:
          OrphanPayment = {
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
              PAYMENT_STATE_TTL_SECONDS,
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
    } catch (recoveryError) {
      console.error(
        "Failed to preserve paid booking for recovery.",
        {
          sessionId,

          error:
            recoveryError instanceof Error
              ? recoveryError.name
              : "unknown",
        }
      );
    }

    return {
      ok: false,
      status: 500,
      recoveryRequired: true,
      retryable: false,

      error:
        "Could not safely confirm the booking. Recovery may be required.",
    };
  } finally {
    if (
      lockAcquired &&
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

export async function completePaidBooking(
  sessionId: string
): Promise<CompletePaidBookingResult> {
  const authorizeEvent =
    await redis.get<AuthorizeEvent>(
      `authorize-event:${sessionId}`
    );

  const session =
    await loadBookingSession(sessionId);

  if (
    authorizeEvent?.transactionId &&
    session
  ) {
    const trustedPayment = {
      sessionId,
      transactionId:
        authorizeEvent.transactionId,
      amount:
        Number(session.total).toFixed(2),
    };

    const bookeoResult =
      await finalizeBookeoBookingForSession(
        sessionId,
        trustedPayment
      );

    if (bookeoResult.ok) {
      void verifyAuthorizePaymentForSession(
        sessionId
      ).catch((error) => {
        console.error(
          "Background Authorize.Net audit failed.",
          {
            sessionId,
            error:
              error instanceof Error
                ? error.name
                : "unknown",
          }
        );
      });
    }

    return bookeoResult;
  }

  /*
   * Recovery path for payments where the webhook
   * never arrived. In that case we still need to
   * locate and verify the Authorize.Net transaction
   * before Bookeo can be finalized.
   */
  const verification =
    await verifyAuthorizePaymentForSession(
      sessionId
    );

  if (!verification.ok) {
    return {
      ok: false,
      pending:
        verification.pending,
      status:
        verification.pending
          ? 202
          : 400,
      error:
        verification.error,
    };
  }

  return finalizeBookeoBookingForSession(
    sessionId
  );
}