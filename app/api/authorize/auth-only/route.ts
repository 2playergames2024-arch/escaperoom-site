import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  type BookingSession,
  isValidBookingSessionId,
} from "@/app/lib/booking";
import {
  claimCheckoutForAuthorization,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";
import {
  ensurePreAuthHold,
} from "@/app/lib/preAuthHold";
import {
  captureSandboxAuthorization,
  voidSandboxAuthorization,
} from "@/app/lib/authorizeSandbox";
import {
  recoverFailedCapture,
} from "@/app/lib/captureRecovery";
import {
  createFinalBookeoBooking,
} from "@/app/lib/finalBookeoBooking";
import {
  lookupFinalBookeoBooking,
} from "@/app/lib/bookeoBookingLookup";
import {
  logBookingEvent,
} from "@/app/lib/bookingLog";

const redis = Redis.fromEnv();

const AUTHORIZE_SANDBOX_LOGIN_ID =
  process.env.AUTHORIZE_SANDBOX_LOGIN_ID;

const AUTHORIZE_SANDBOX_TRANSACTION_KEY =
  process.env.AUTHORIZE_SANDBOX_TRANSACTION_KEY;

const AUTHORIZE_SANDBOX_URL =
  "https://apitest.authorize.net/xml/v1/request.api";

async function captureBookedCheckout({
  checkoutId,
  transactionId,
  amount,
  bookeoBookingId,
  responseData,
}: {
  checkoutId: string;
  transactionId: string;
  amount: number;
  bookeoBookingId: string;
  responseData: Record<string, unknown>;
}) {
  /*
   * STEP 23:
   * Bookeo is positively BOOKED.
   *
   * Make the first prior-auth capture attempt.
   */
  logBookingEvent(
    "capture.started",
    {
      checkoutId,
      authorizeTransactionId:
        transactionId,
      bookeoBookingId,
      previousStatus:
        BOOKING_STATES.BOOKED,
    }
  );

  const captureResult =
    await captureSandboxAuthorization(
      transactionId,
      amount
    );

  if (captureResult.ok) {
    logBookingEvent(
      "capture.succeeded",
      {
        checkoutId,
        authorizeTransactionId:
          captureResult.transactionId,
        bookeoBookingId,
        result: "captured",
      }
    );

    await updateBookingLedgerRecord({
      checkoutId,

      status:
        BOOKING_STATES.COMPLETE,
    });

    return NextResponse.json({
      ...responseData,

      authorized: true,
      booked: true,
      captured: true,
      complete: true,

      transactionId:
        captureResult.transactionId,

      bookeoBookingId,
    });
  }

  /*
   * STEP 24:
   * The first capture did not produce a confirmed
   * success. Persist CAPTURE_FAILED first.
   */
  logBookingEvent(
    "capture.failed",
    {
      checkoutId,
      authorizeTransactionId:
        transactionId,
      bookeoBookingId,
      result:
        captureResult.uncertain
          ? "uncertain"
          : "rejected",
      errorCode:
        captureResult.uncertain
          ? "CAPTURE_UNCERTAIN"
          : "CAPTURE_REJECTED",
    },
    captureResult.uncertain
      ? "warn"
      : "error"
  );

  await updateBookingLedgerRecord({
    checkoutId,

    status:
      BOOKING_STATES.CAPTURE_FAILED,

    errorCode:
      captureResult.uncertain
        ? "CAPTURE_UNCERTAIN"
        : "CAPTURE_REJECTED",

    errorMessage:
      captureResult.message,

    errorData: {
      authorizeTransactionId:
        transactionId,

      bookeoBookingId,

      uncertain:
        captureResult.uncertain,
    },
  });

  /*
   * Never retry capture blindly.
   *
   * recoverFailedCapture() asks Authorize.Net for
   * the real transaction state before every retry.
   */
  const recoveryResult =
    await recoverFailedCapture({
      checkoutId,
      transactionId,
      bookeoBookingId,
      amount,
    });

  if (recoveryResult.ok) {
    logBookingEvent(
      "capture.recovered",
      {
        checkoutId,
        authorizeTransactionId:
          recoveryResult.transactionId,
        bookeoBookingId,
        result:
          recoveryResult.recoveredBy,
        attempt:
          recoveryResult.retryAttempts,
      }
    );

    return NextResponse.json({
      ...responseData,

      authorized: true,
      booked: true,
      captured: true,
      complete: true,
      captureRecovered:
        true,

      captureRecoveredBy:
        recoveryResult.recoveredBy,

      captureRetryAttempts:
        recoveryResult.retryAttempts,

      transactionId:
        recoveryResult.transactionId,

      bookeoBookingId,
    });
  }

  logBookingEvent(
    "capture.recovery_exhausted",
    {
      checkoutId,
      authorizeTransactionId:
        transactionId,
      bookeoBookingId,
      result:
        recoveryResult.finalStatus,
      attempt:
        recoveryResult.retryAttempts,
      errorCode:
        "CAPTURE_RECOVERY_EXHAUSTED",
    },
    "error"
  );

  return NextResponse.json(
    {
      ...responseData,

      authorized: true,
      booked: true,
      captured: false,
      captureFailed: true,
      recoveryRequired: true,

      transactionId,
      bookeoBookingId,

      captureRetryAttempts:
        recoveryResult.retryAttempts,

      authorizeStatus:
        recoveryResult.finalStatus,

      staffAlertSent:
        recoveryResult.alertSent,

      error:
        "The Bookeo booking was created, but payment capture recovery was exhausted.",
    },
    {
      status: 502,
    }
  );
}

type OpaqueData = {
  dataDescriptor: string;
  dataValue: string;
};

export async function POST(
  request: NextRequest
) {
  try {
    if (
      !AUTHORIZE_SANDBOX_LOGIN_ID ||
      !AUTHORIZE_SANDBOX_TRANSACTION_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.Net sandbox credentials are not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const sessionId =
      String(body.sessionId || "");

    const opaqueData =
      body.opaqueData as OpaqueData | undefined;

    if (!isValidBookingSessionId(sessionId)) {
      return NextResponse.json(
        {
          error:
            "The booking session is invalid or expired.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !opaqueData ||
      opaqueData.dataDescriptor !==
      "COMMON.ACCEPT.INAPP.PAYMENT" ||
      !opaqueData.dataValue
    ) {
      return NextResponse.json(
        {
          error:
            "The secure payment token is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    let session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    logBookingEvent(
      "payment.request_received",
      {
        sessionId,
        checkoutId:
          session?.checkoutId ?? null,
        holdId:
          session?.holdId ?? null,
      }
    );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "The booking session could not be found or has expired.",
        },
        {
          status: 410,
        }
      );
    }

    /*
     * STEP 15:
     * Verify the current Bookeo hold before any
     * Authorize.Net authorization is attempted.
     */
    const preAuthHoldResult =
      await ensurePreAuthHold(session);

    if (!preAuthHoldResult.ok) {
      if (
        preAuthHoldResult.reason ===
        "UNAVAILABLE"
      ) {
        return NextResponse.json(
          {
            error:
              "Sorry, those seats are no longer available.",
            unavailable: true,
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "Bookeo could not verify the booking hold. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    session =
      preAuthHoldResult.session;

    logBookingEvent(
      "hold.pre_auth_validated",
      {
        sessionId:
          session.sessionId,
        checkoutId:
          session.checkoutId,
        holdId:
          session.holdId,
        result:
          preAuthHoldResult.replaced
            ? "replaced"
            : "valid",
      }
    );

    /*
     * STEP 17:
     * Atomic server-side payment-attempt lock.
     *
     * Exactly one request can move this checkout
     * from HOLD_CREATED to AUTHORIZING.
     */
    const claimedCheckout =
      await claimCheckoutForAuthorization(
        session.checkoutId
      );

    if (!claimedCheckout) {
      return NextResponse.json(
        {
          error:
            "This payment attempt has already been started.",
        },
        {
          status: 409,
        }
      );
    }

    const amount =
      Number(session.total);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        status:
          BOOKING_STATES.FAILED,
        errorCode:
          "INVALID_AMOUNT",
        errorMessage:
          "Trusted booking amount was invalid.",
      });

      return NextResponse.json(
        {
          error:
            "The booking total is invalid.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * STEP 18:
     * AUTH-ONLY.
     *
     * No capture occurs here.
     */
    const authorizeRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name:
            AUTHORIZE_SANDBOX_LOGIN_ID,
          transactionKey:
            AUTHORIZE_SANDBOX_TRANSACTION_KEY,
        },

        refId:
          session.checkoutId.slice(
            0,
            20
          ),

        transactionRequest: {
          transactionType:
            "authOnlyTransaction",

          amount:
            amount.toFixed(2),

          payment: {
            opaqueData: {
              dataDescriptor:
                opaqueData.dataDescriptor,
              dataValue:
                opaqueData.dataValue,
            },
          },

          order: {
            invoiceNumber:
              session.checkoutId.slice(
                0,
                20
              ),
          },
        },
      },
    };

    logBookingEvent(
      "authorization.started",
      {
        sessionId:
          session.sessionId,
        checkoutId:
          session.checkoutId,
        holdId:
          session.holdId,
        previousStatus:
          BOOKING_STATES.AUTHORIZING,
      }
    );

    const authorizationInvoiceNumber =
      session.checkoutId.slice(
        0,
        20
      );

    let authorizeResponse: Response;

    try {
      authorizeResponse =
        await fetch(
          AUTHORIZE_SANDBOX_URL,
          {
            method: "POST",
            cache: "no-store",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              authorizeRequest
            ),
            signal:
              AbortSignal.timeout(
                15_000
              ),
          }
        );
    } catch (error) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        errorCode:
          "AUTHORIZATION_RESULT_UNCERTAIN",
        errorMessage:
          "Authorize.Net may have received the AUTH-ONLY request, but no response was confirmed.",
        errorData: {
          invoiceNumber:
            authorizationInvoiceNumber,
          reason:
            error instanceof Error
              ? error.name
              : "unknown",
        },
      });

      return NextResponse.json(
        {
          error:
            "Authorize.Net did not return a confirmed result.",
          uncertain: true,
        },
        { status: 502 }
      );
    }

    let authorizeData: any = null;

    try {
      authorizeData =
        await authorizeResponse.json();
    } catch {
      authorizeData = null;
    }

    const transactionResponse =
      authorizeData?.transactionResponse;

    const responseCode =
      String(
        transactionResponse?.responseCode ||
        ""
      );

    const transactionId =
      String(
        transactionResponse?.transId ||
        ""
      ).trim();

    const confirmedTransactionId =
      transactionId && transactionId !== "0"
        ? transactionId
        : "";

    const transactionMessage =
      String(
        transactionResponse?.messages?.[0]
          ?.description ||
        transactionResponse?.errors?.[0]
          ?.errorText ||
        authorizeData?.messages?.message?.[0]
          ?.text ||
        ""
      );

    if (!authorizeResponse.ok) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        ...(confirmedTransactionId
          ? {
              authorizeTransactionId:
                confirmedTransactionId,
            }
          : {}),
        errorCode:
          "AUTHORIZATION_RESULT_UNCERTAIN",
        errorMessage:
          "Authorize.Net returned a non-success HTTP result after AUTH-ONLY was sent.",
        errorData: {
          invoiceNumber:
            authorizationInvoiceNumber,
          httpStatus:
            authorizeResponse.status,
          authorizeTransactionId:
            confirmedTransactionId || null,
        },
      });

      return NextResponse.json(
        {
          error:
            "Authorize.Net did not return a confirmed result.",
          uncertain: true,
        },
        { status: 502 }
      );
    }

    /*
     * responseCode 1 = approved.
     */
    if (
      responseCode === "1" &&
      transactionId &&
      transactionId !== "0"
    ) {
      logBookingEvent(
        "authorization.approved",
        {
          sessionId:
            session.sessionId,
          checkoutId:
            session.checkoutId,
          holdId:
            session.holdId,
          authorizeTransactionId:
            transactionId,
          result: "approved",
        }
      );

      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        authorizeTransactionId:
          transactionId,
        status:
          BOOKING_STATES.AUTHORIZED,
      });

      /*
       * STEP 19:
       * Authorization succeeded.
       *
       * Check the Bookeo hold again before
       * attempting final Bookeo creation.
       */
      const postAuthHoldResult =
        await ensurePreAuthHold(
          session
        );

      if (!postAuthHoldResult.ok) {
        /*
         * Bookeo explicitly says the seats
         * are no longer available.
         *
         * The authorization must be voided.
         */
        if (
          postAuthHoldResult.reason ===
          "UNAVAILABLE"
        ) {
          const voidResult =
            await voidSandboxAuthorization(
              transactionId
            );

          if (voidResult.ok) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,
              status:
                BOOKING_STATES.VOIDED,
              errorCode:
                "POST_AUTH_HOLD_UNAVAILABLE",
              errorMessage:
                "Bookeo seats became unavailable after authorization.",
            });

            return NextResponse.json(
              {
                authorized: false,
                voided: true,
                unavailable: true,
                error:
                  "Sorry, those seats are no longer available. The card authorization was voided.",
              },
              {
                status: 409,
              }
            );
          }

          /*
           * We know the seats are unavailable,
           * but we could not confirm the void.
           *
           * Keep the ledger AUTHORIZED so
           * recovery can deal with the real
           * gateway state.
           */
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,
            errorCode:
              "POST_AUTH_VOID_NOT_CONFIRMED",
            errorMessage:
              voidResult.message,
            errorData: {
              authorizeTransactionId:
                transactionId,
              uncertain:
                voidResult.uncertain,
            },
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,
              error:
                "The seats are no longer available, and the payment authorization requires recovery.",
            },
            {
              status: 502,
            }
          );
        }

        /*
         * Bookeo did not give us a definitive
         * availability result.
         *
         * Do NOT void and do NOT authorize again.
         * Preserve AUTHORIZED for recovery.
         */
        await updateBookingLedgerRecord({
          checkoutId:
            session.checkoutId,
          errorCode:
            "POST_AUTH_BOOKEO_ERROR",
          errorMessage:
            "Bookeo could not confirm the hold after authorization.",
          errorData: {
            authorizeTransactionId:
              transactionId,
          },
        });

        return NextResponse.json(
          {
            authorized: true,
            recoveryRequired: true,
            error:
              "The card was authorized, but the booking hold could not be confirmed.",
          },
          {
            status: 502,
          }
        );
      }

      /*
       * The hold is valid, or a replacement
       * hold was successfully created.
       */
      session =
        postAuthHoldResult.session;

      logBookingEvent(
        "hold.post_auth_validated",
        {
          sessionId:
            session.sessionId,
          checkoutId:
            session.checkoutId,
          holdId:
            session.holdId,
          authorizeTransactionId:
            transactionId,
          result:
            postAuthHoldResult.replaced
              ? "replaced"
              : "valid",
        }
      );

      /*
       * STEP 20:
       * Create the final Bookeo booking from
       * the current validated hold.
       *
       * Payment is still AUTH-ONLY here.
       * Capture happens later.
       */
      const finalBookeoResult =
        await createFinalBookeoBooking(
          session,
          transactionId
        );

      if (!finalBookeoResult.ok) {
        /*
         * A definite Bookeo rejection means
         * no booking was created.
         *
         * Void the card authorization.
         */
        if (
          finalBookeoResult.reason ===
          "REJECTED"
        ) {
          const voidResult =
            await voidSandboxAuthorization(
              transactionId
            );

          if (voidResult.ok) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              status:
                BOOKING_STATES.VOIDED,

              errorCode:
                "BOOKEO_FINALIZE_REJECTED",

              errorMessage:
                finalBookeoResult.message,

              errorData: {
                bookeoStatus:
                  finalBookeoResult.status,

                bookeoData:
                  finalBookeoResult.data,
              },
            });

            return NextResponse.json(
              {
                authorized: false,
                voided: true,

                error:
                  "Bookeo could not create the booking. The card authorization was voided.",
              },
              {
                status: 502,
              }
            );
          }

          /*
           * Bookeo definitely rejected,
           * but the void was not confirmed.
           *
           * Preserve AUTHORIZED for recovery.
           */
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            errorCode:
              "BOOKEO_REJECTED_VOID_NOT_CONFIRMED",

            errorMessage:
              voidResult.message,

            errorData: {
              authorizeTransactionId:
                transactionId,

              bookeoStatus:
                finalBookeoResult.status,

              voidUncertain:
                voidResult.uncertain,
            },
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,

              error:
                "Bookeo rejected the booking, and the authorization void requires recovery.",
            },
            {
              status: 502,
            }
          );
        }

        /*
         * Timeout, 5xx, network failure,
         * or success without bookingNumber.
         *
         * Do NOT send another Bookeo CREATE.
         * Step 21 will perform booking lookup.
         */
        /*
 * STEP 21:
 * The CREATE result was uncertain.
 *
 * Verify whether Bookeo actually created
 * the booking before allowing any
 * additional CREATE attempt.
 */
        let lastLookupError =
          "";

        for (
          let lookupAttempt = 1;
          lookupAttempt <= 3;
          lookupAttempt++
        ) {
          if (lookupAttempt > 1) {
            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  lookupAttempt === 2
                    ? 1000
                    : 2000
                )
            );
          }

          const lookupResult =
            await lookupFinalBookeoBooking(
              session
            );

          /*
           * Exactly one booking carrying our
           * unique checkout externalRef exists.
           */
          if (
            lookupResult.ok &&
            lookupResult.result ===
            "FOUND"
          ) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              bookeoBookingId:
                lookupResult.bookingId,

              status:
                BOOKING_STATES.BOOKED,
            });

            return captureBookedCheckout({
              checkoutId:
                session.checkoutId,

              transactionId,

              amount,

              bookeoBookingId:
                lookupResult.bookingId,

              responseData: {
                recoveredByLookup:
                  true,
              },
            });
          }

          /*
           * More than one booking with the same
           * unique checkout ID should never occur.
           *
           * Stop automation.
           */
          if (
            lookupResult.ok &&
            lookupResult.result ===
            "AMBIGUOUS"
          ) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              errorCode:
                "BOOKEO_LOOKUP_MULTIPLE_MATCHES",

              errorMessage:
                "Multiple Bookeo bookings matched the same checkout ID.",

              errorData: {
                authorizeTransactionId:
                  transactionId,

                checkoutId:
                  session.checkoutId,

                matches:
                  lookupResult.matches,
              },
            });

            return NextResponse.json(
              {
                authorized: true,

                recoveryRequired:
                  true,

                error:
                  "Multiple Bookeo bookings matched this checkout. Automatic recovery stopped.",
              },
              {
                status: 409,
              }
            );
          }

          /*
           * Lookup itself failed.
           *
           * Do not interpret that as zero
           * bookings and do not CREATE again.
           */
          if (!lookupResult.ok) {
            lastLookupError =
              lookupResult.message;

            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              errorCode:
                "BOOKEO_LOOKUP_FAILED",

              errorMessage:
                lookupResult.message,

              errorData: {
                authorizeTransactionId:
                  transactionId,

                checkoutId:
                  session.checkoutId,

                lookupAttempt,
              },
            });

            return NextResponse.json(
              {
                authorized: true,

                recoveryRequired:
                  true,

                error:
                  "Bookeo booking verification could not be completed.",
              },
              {
                status: 502,
              }
            );
          }

          /*
           * NO_MATCH:
           * try again unless this was the
           * third and final lookup.
           */
        }

        /*
  * STEP 22:
  *
  * Three successful lookups found zero
  * Bookeo bookings.
  *
  * Before allowing exactly one controlled
  * second CREATE, verify that we still
  * have a valid Bookeo hold.
  */
        const retryHoldResult =
          await ensurePreAuthHold(
            session
          );

        if (!retryHoldResult.ok) {
          /*
           * We cannot safely issue the second
           * CREATE without a confirmed hold.
           */
          if (
            retryHoldResult.reason ===
            "UNAVAILABLE"
          ) {
            const voidResult =
              await voidSandboxAuthorization(
                transactionId
              );

            if (voidResult.ok) {
              await updateBookingLedgerRecord({
                checkoutId:
                  session.checkoutId,

                status:
                  BOOKING_STATES.VOIDED,

                errorCode:
                  "SECOND_CREATE_HOLD_UNAVAILABLE",

                errorMessage:
                  "No Bookeo booking was found and the hold could not be restored before the controlled second CREATE.",
              });

              return NextResponse.json(
                {
                  authorized: false,
                  voided: true,
                  unavailable: true,

                  error:
                    "The booking could not be confirmed and the card authorization was voided.",
                },
                {
                  status: 409,
                }
              );
            }

            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              errorCode:
                "SECOND_CREATE_HOLD_VOID_NOT_CONFIRMED",

              errorMessage:
                voidResult.message,

              errorData: {
                authorizeTransactionId:
                  transactionId,

                uncertain:
                  voidResult.uncertain,
              },
            });

            return NextResponse.json(
              {
                authorized: true,
                recoveryRequired: true,

                error:
                  "The booking could not be confirmed and the authorization void requires recovery.",
              },
              {
                status: 502,
              }
            );
          }

          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            errorCode:
              "SECOND_CREATE_HOLD_CHECK_FAILED",

            errorMessage:
              "Bookeo could not confirm a valid hold before the controlled second CREATE.",
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,

              error:
                "Bookeo could not safely verify the hold before recovery.",
            },
            {
              status: 502,
            }
          );
        }

        session =
          retryHoldResult.session;

        /*
         * Exactly ONE controlled second CREATE.
         *
         * There is no code path below this point
         * that performs a third CREATE.
         */
        const secondCreateResult =
          await createFinalBookeoBooking(
            session,
            transactionId
          );

        /*
         * Second CREATE positively succeeded.
         */
        if (secondCreateResult.ok) {
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            bookeoBookingId:
              secondCreateResult.bookingId,

            status:
              BOOKING_STATES.BOOKED,

            errorCode:
              null,

            errorMessage:
              null,
          });

          return captureBookedCheckout({
            checkoutId:
              session.checkoutId,

            transactionId,

            amount,

            bookeoBookingId:
              secondCreateResult.bookingId,

            responseData: {
              recoveredBySecondCreate:
                true,
            },
          });
        }

        /*
         * Second CREATE was explicitly rejected.
         * No booking was created, so void.
         */
        if (
          secondCreateResult.reason ===
          "REJECTED"
        ) {
          const voidResult =
            await voidSandboxAuthorization(
              transactionId
            );

          if (voidResult.ok) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,

              status:
                BOOKING_STATES.VOIDED,

              errorCode:
                "SECOND_CREATE_REJECTED",

              errorMessage:
                secondCreateResult.message,

              errorData: {
                bookeoStatus:
                  secondCreateResult.status,

                bookeoData:
                  secondCreateResult.data,
              },
            });

            return NextResponse.json(
              {
                authorized: false,
                voided: true,

                error:
                  "Bookeo rejected the recovery booking and the card authorization was voided.",
              },
              {
                status: 502,
              }
            );
          }

          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            errorCode:
              "SECOND_CREATE_REJECTED_VOID_NOT_CONFIRMED",

            errorMessage:
              voidResult.message,
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,

              error:
                "Bookeo rejected the recovery booking and the authorization void requires recovery.",
            },
            {
              status: 502,
            }
          );
        }

        /*
         * The second CREATE result itself was
         * uncertain.
         *
         * Perform ONE final lookup.
         */
        const finalLookup =
          await lookupFinalBookeoBooking(
            session
          );

        if (
          finalLookup.ok &&
          finalLookup.result ===
          "FOUND"
        ) {
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            bookeoBookingId:
              finalLookup.bookingId,

            status:
              BOOKING_STATES.BOOKED,

            errorCode:
              null,

            errorMessage:
              null,
          });

          return captureBookedCheckout({
            checkoutId:
              session.checkoutId,

            transactionId,

            amount,

            bookeoBookingId:
              finalLookup.bookingId,

            responseData: {
              recoveredByFinalLookup:
                true,
            },
          });
        }

        /*
         * Multiple bookings with our unique
         * checkout ID means automation stops.
         */
        if (
          finalLookup.ok &&
          finalLookup.result ===
          "AMBIGUOUS"
        ) {
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            errorCode:
              "FINAL_LOOKUP_MULTIPLE_MATCHES",

            errorMessage:
              "Multiple Bookeo bookings matched the checkout after the controlled second CREATE.",

            errorData: {
              authorizeTransactionId:
                transactionId,

              matches:
                finalLookup.matches,
            },
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,

              error:
                "Multiple Bookeo bookings matched this checkout. Automatic recovery stopped.",
            },
            {
              status: 409,
            }
          );
        }

        /*
         * If the final lookup itself failed,
         * preserve AUTHORIZED for manual recovery.
         * We do not pretend this means no booking.
         */
        if (!finalLookup.ok) {
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            errorCode:
              "FINAL_LOOKUP_FAILED",

            errorMessage:
              finalLookup.message,
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,

              error:
                "The final Bookeo verification could not be completed.",
            },
            {
              status: 502,
            }
          );
        }

        /*
         * Final lookup positively completed and
         * found zero bookings.
         *
         * Both allowed CREATE attempts are now
         * exhausted. Void the authorization.
         */
        const finalVoidResult =
          await voidSandboxAuthorization(
            transactionId
          );

        if (finalVoidResult.ok) {
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,

            status:
              BOOKING_STATES.VOIDED,

            errorCode:
              "SECOND_CREATE_FINAL_NO_MATCH",

            errorMessage:
              "Two Bookeo CREATE attempts were exhausted and the final verification found no booking.",
          });

          return NextResponse.json(
            {
              authorized: false,
              voided: true,

              error:
                "The booking could not be confirmed and the card authorization was voided.",
            },
            {
              status: 502,
            }
          );
        }

        await updateBookingLedgerRecord({
          checkoutId:
            session.checkoutId,

          errorCode:
            "FINAL_NO_MATCH_VOID_NOT_CONFIRMED",

          errorMessage:
            finalVoidResult.message,

          errorData: {
            authorizeTransactionId:
              transactionId,

            uncertain:
              finalVoidResult.uncertain,
          },
        });

        return NextResponse.json(
          {
            authorized: true,
            recoveryRequired: true,

            error:
              "No Bookeo booking was confirmed, and the authorization void requires recovery.",
          },
          {
            status: 502,
          }
        );
      }

      /*
       * Bookeo positively confirmed the
       * booking and returned bookingNumber.
       */
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,

        bookeoBookingId:
          finalBookeoResult.bookingId,

        status:
          BOOKING_STATES.BOOKED,
      });

      return captureBookedCheckout({
        checkoutId:
          session.checkoutId,

        transactionId,

        amount,

        bookeoBookingId:
          finalBookeoResult.bookingId,

        responseData: {
          postAuthHoldValid:
            true,

          holdReplaced:
            postAuthHoldResult.replaced,
        },
      });
    }

    /*
     * responseCode 2 or 3 is an explicit
     * decline/error result from Authorize.Net.
     *
     * No Bookeo booking is created.
     */
    if (
      responseCode === "2" ||
      responseCode === "3"
    ) {
      logBookingEvent(
        "authorization.declined",
        {
          sessionId:
            session.sessionId,
          checkoutId:
            session.checkoutId,
          holdId:
            session.holdId,
          authorizeTransactionId:
            transactionId || null,
          result:
            responseCode,
          errorCode:
            `AUTHORIZE_${responseCode}`,
        },
        "warn"
      );

      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        status:
          BOOKING_STATES.FAILED,
        errorCode:
          `AUTHORIZE_${responseCode}`,
        errorMessage:
          transactionMessage ||
          "Authorize.Net declined the authorization.",
        errorData: {
          responseCode,
        },
      });

      return NextResponse.json(
        {
          authorized: false,
          declined: true,
          error:
            transactionMessage ||
            "The card was declined.",
        },
        {
          status: 402,
        }
      );
    }

    /*
     * Anything else is ambiguous.
     * Leave the ledger AUTHORIZING so we do not
     * accidentally send another authorization.
     * Persist any transaction ID Authorize.Net did
     * return so delayed reconciliation can own it.
     */
    await updateBookingLedgerRecord({
      checkoutId:
        session.checkoutId,
      ...(confirmedTransactionId
        ? {
            authorizeTransactionId:
              confirmedTransactionId,
          }
        : {}),
      errorCode:
        "AUTHORIZATION_RESULT_UNCERTAIN",
      errorMessage:
        transactionMessage ||
        "Authorize.Net returned an ambiguous authorization result.",
      errorData: {
        invoiceNumber:
          authorizationInvoiceNumber,
        responseCode:
          responseCode || null,
        authorizeTransactionId:
          confirmedTransactionId || null,
      },
    });

    return NextResponse.json(
      {
        error:
          "Authorize.Net did not return a confirmed authorization result.",
        uncertain: true,
      },
      { status: 502 }
    );
  } catch (error) {
    console.error(
      "Authorize.Net AUTH-ONLY failed.",
      error
    );

    return NextResponse.json(
      {
        error:
          "We could not confirm the payment authorization.",
        uncertain: true,
      },
      {
        status: 502,
      }
    );
  }
}
