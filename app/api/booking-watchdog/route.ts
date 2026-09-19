import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";

import {
  type BookingSession,
  isValidBookingSessionId,
} from "@/app/lib/booking";
import {
  getBookingLedgerRecord,
  markBookingCaptureComplete,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";
import {
  getAuthorizeTransactionState,
  voidAuthorizeAuthorization,
} from "@/app/lib/authorizeSandbox";
import {
  findAuthorizeRecentTransactionByInvoiceNumber,
} from "@/app/lib/authorizeRecentTransactionLookup";
import {
  lookupFinalBookeoBooking,
} from "@/app/lib/bookeoBookingLookup";
import {
  cancelBookeoBooking,
  deleteBookeoHold,
} from "@/app/lib/bookeoCancellation";
import {
  claimBookingWatchdogResolver,
  clearBookingWatchdogTakeover,
  releaseBookingWatchdogResolver,
  requestBookingWatchdogTakeover,
  waitForPaymentRouteRelease,
} from "@/app/lib/bookingWatchdog";
import {
  logBookingEvent,
} from "@/app/lib/bookingLog";
import {
  ensureBookeoPaymentRecorded,
} from "@/app/lib/bookeoPaymentSync";

const redis = Redis.fromEnv();

const CAPTURED_STATUSES =
  new Set([
    "capturedPendingSettlement",
    "settledSuccessfully",
  ]);

const AUTHORIZED_PENDING_CAPTURE =
  "authorizedPendingCapture";

const VOIDED_STATUSES =
  new Set([
    "voided",
    "declined",
    "expired",
  ]);

type LedgerRow = {
  checkout_id?: string;
  checkoutId?: string;
  hold_id?: string | null;
  holdId?: string | null;
  authorize_transaction_id?: string | null;
  authorizeTransactionId?: string | null;
  bookeo_booking_id?: string | null;
  bookeoBookingId?: string | null;
  status?: string;
  error_code?: string | null;
  errorCode?: string | null;
};

function getTransactionId(
  row: LedgerRow | null
) {
  return String(
    row?.authorize_transaction_id ||
    row?.authorizeTransactionId ||
    ""
  ).trim();
}

function getBookeoBookingId(
  row: LedgerRow | null
) {
  return String(
    row?.bookeo_booking_id ||
    row?.bookeoBookingId ||
    ""
  ).trim();
}

function getHoldId(
  row: LedgerRow | null,
  session: BookingSession
) {
  return String(
    row?.hold_id ||
    row?.holdId ||
    session.holdId ||
    ""
  ).trim();
}

function pendingResponse(
  message:
    | string
    | undefined = undefined
) {
  return NextResponse.json({
    status: "pending",
    message:
      message ||
      "We are still verifying your booking and payment status.",
  });
}

async function finishFailure({
  session,
  checkoutId,
  holdId,
  terminalStatus,
  errorCode,
  errorMessage,
}: {
  session: BookingSession;
  checkoutId: string;
  holdId: string;
  terminalStatus:
    | typeof BOOKING_STATES.VOIDED
    | typeof BOOKING_STATES.FAILED;
  errorCode: string;
  errorMessage: string;
}) {
  const holdCleanup =
    await deleteBookeoHold({
      session,
      holdId,
    });

  if (!holdCleanup.ok) {
    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "WATCHDOG_HOLD_DELETE_UNCONFIRMED",
      errorMessage:
        holdCleanup.message,
      errorData: {
        uncertain:
          holdCleanup.uncertain,
      },
    });

    return pendingResponse(
      "The transaction cleanup is still being verified."
    );
  }

  await updateBookingLedgerRecord({
    checkoutId,
    status:
      terminalStatus,
    errorCode,
    errorMessage,
  });

  await clearBookingWatchdogTakeover(
    checkoutId
  );

  logBookingEvent(
    "watchdog.failed_cleanly",
    {
      sessionId:
        session.sessionId,
      checkoutId,
      holdId:
        holdId || null,
      nextStatus:
        terminalStatus,
      errorCode,
    },
    "warn"
  );

  return NextResponse.json({
    status: "failed",
  });
}

async function cancelBookingThenFail({
  session,
  checkoutId,
  holdId,
  bookingId,
  errorCode,
  errorMessage,
}: {
  session: BookingSession;
  checkoutId: string;
  holdId: string;
  bookingId: string;
  errorCode: string;
  errorMessage: string;
}) {
  const cancellation =
    await cancelBookeoBooking({
      session,
      bookingId,
    });

  if (!cancellation.ok) {
    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "WATCHDOG_BOOKEO_CANCEL_UNCONFIRMED",
      errorMessage:
        cancellation.message,
      errorData: {
        bookeoBookingId:
          bookingId,
        uncertain:
          cancellation.uncertain,
      },
    });

    return pendingResponse(
      "The booking cleanup is still being verified."
    );
  }

  return finishFailure({
    session,
    checkoutId,
    holdId,
    terminalStatus:
      BOOKING_STATES.VOIDED,
    errorCode,
    errorMessage,
  });
}

export async function POST(
  request: Request
) {
  const resolverRequestId =
    randomUUID();

  let resolverCheckoutId = "";

  try {
    const body =
      await request.json();

    const sessionId =
      String(
        body.sessionId || ""
      ).trim();

    if (
      !isValidBookingSessionId(
        sessionId
      )
    ) {
      return NextResponse.json(
        {
          status: "invalid",
          error:
            "Missing or invalid booking session ID.",
        },
        {
          status: 400,
        }
      );
    }

    const session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      return NextResponse.json(
        {
          status: "invalid",
          error:
            "The booking session could not be found.",
        },
        {
          status: 410,
        }
      );
    }

    const checkoutId =
      session.checkoutId;

    let ledger =
      (await getBookingLedgerRecord(
        checkoutId
      )) as LedgerRow | null;

    if (!ledger) {
      return pendingResponse(
        "The transaction record is still being located."
      );
    }

    /*
     * COMPLETE is durable proof that the normal route
     * already confirmed Bookeo and Authorize.Net capture.
     */
    if (
      String(ledger.status || "") ===
      BOOKING_STATES.COMPLETE
    ) {
      await clearBookingWatchdogTakeover(
        checkoutId
      );

      return NextResponse.json({
        status: "confirmed",
        bookingId:
          getBookeoBookingId(
            ledger
          ),
      });
    }

    if (
      String(ledger.status || "") ===
        BOOKING_STATES.VOIDED ||
      String(ledger.status || "") ===
        BOOKING_STATES.FAILED
    ) {
      await clearBookingWatchdogTakeover(
        checkoutId
      );

      return NextResponse.json({
        status: "failed",
      });
    }

    /*
     * Only one watchdog request may resolve a checkout at
     * a time. This prevents two tabs or overlapping retries
     * from voiding/canceling the same external state.
     */
    const resolverOwned =
      await claimBookingWatchdogResolver(
        checkoutId,
        resolverRequestId
      );

    if (!resolverOwned) {
      return pendingResponse(
        "Another verification request is already resolving this checkout."
      );
    }

    resolverCheckoutId = checkoutId;

    /*
     * Ask the synchronous payment route to stop starting
     * new consequential work. Then wait until its active
     * ownership key is gone before this watchdog mutates
     * Bookeo or Authorize.Net.
     */
    await requestBookingWatchdogTakeover(
      checkoutId
    );

    logBookingEvent(
      "watchdog.takeover_requested",
      {
        sessionId,
        checkoutId,
        holdId:
          session.holdId,
        previousStatus:
          String(
            ledger.status || ""
          ),
      },
      "warn"
    );

    const routeReleased =
      await waitForPaymentRouteRelease(
        checkoutId,
        20_000
      );

    if (!routeReleased) {
      return pendingResponse(
        "The original payment request is still finishing safely."
      );
    }

    /*
     * The synchronous route may have completed while we
     * were waiting for ownership to be released.
     */
    ledger =
      (await getBookingLedgerRecord(
        checkoutId
      )) as LedgerRow | null;

    if (!ledger) {
      return pendingResponse();
    }

    if (
      String(ledger.status || "") ===
      BOOKING_STATES.COMPLETE
    ) {
      await clearBookingWatchdogTakeover(
        checkoutId
      );

      return NextResponse.json({
        status: "confirmed",
        bookingId:
          getBookeoBookingId(
            ledger
          ),
      });
    }

    if (
      String(ledger.status || "") ===
        BOOKING_STATES.VOIDED ||
      String(ledger.status || "") ===
        BOOKING_STATES.FAILED
    ) {
      await clearBookingWatchdogTakeover(
        checkoutId
      );

      return NextResponse.json({
        status: "failed",
      });
    }

    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "WATCHDOG_RESOLVING_TIMEOUT",
      errorMessage:
        "The 30-second checkout watchdog is resolving the authoritative Bookeo and Authorize.Net state.",
    });

    const holdId =
      getHoldId(
        ledger,
        session
      );

    /*
     * First determine whether a real Bookeo booking exists.
     * This lookup is read-only.
     */
    const bookeoLookup =
      await lookupFinalBookeoBooking(
        session
      );

    if (!bookeoLookup.ok) {
      return pendingResponse(
        "Bookeo could not be reached to verify the reservation."
      );
    }

    if (
      bookeoLookup.result ===
      "AMBIGUOUS"
    ) {
      await updateBookingLedgerRecord({
        checkoutId,
        errorCode:
          "WATCHDOG_MULTIPLE_BOOKEO_MATCHES",
        errorMessage:
          "Multiple Bookeo bookings matched the checkout during watchdog resolution.",
        errorData: {
          matches:
            bookeoLookup.matches,
        },
      });

      return pendingResponse(
        "The reservation requires additional verification."
      );
    }

    const bookingId =
      bookeoLookup.result ===
      "FOUND"
        ? bookeoLookup.bookingId
        : "";

    if (bookingId) {
      await updateBookingLedgerRecord({
        checkoutId,
        bookeoBookingId:
          bookingId,
      });
    }

    /*
     * Recover the Authorize.Net transaction ID if the
     * original AUTH-ONLY response was lost before it was
     * persisted to Postgres.
     */
    let transactionId =
      getTransactionId(
        ledger
      );

    if (!transactionId) {
      const invoiceNumber =
        checkoutId.slice(
          0,
          20
        );

      const invoiceLookup =
        await findAuthorizeRecentTransactionByInvoiceNumber(
          invoiceNumber
        );

      if (!invoiceLookup.ok) {
        return pendingResponse(
          "Authorize.Net could not be reached to verify the payment."
        );
      }

      if (
        invoiceLookup.result ===
        "AMBIGUOUS"
      ) {
        await updateBookingLedgerRecord({
          checkoutId,
          errorCode:
            "WATCHDOG_MULTIPLE_AUTHNET_MATCHES",
          errorMessage:
            "Multiple Authorize.Net transactions matched the checkout during watchdog resolution.",
          errorData: {
            matches:
              invoiceLookup.matches,
          },
        });

        return pendingResponse(
          "The payment requires additional verification."
        );
      }

      if (
        invoiceLookup.result ===
        "FOUND"
      ) {
        transactionId =
          invoiceLookup.transactionId;

        await updateBookingLedgerRecord({
          checkoutId,
          authorizeTransactionId:
            transactionId,
        });
      }
    }

    /*
     * No Authorize.Net transaction exists and no Bookeo
     * booking exists. Cleanup the temporary hold and
     * finish as a clean failure.
     */
    if (
      !transactionId &&
      !bookingId
    ) {
      return finishFailure({
        session,
        checkoutId,
        holdId,
        terminalStatus:
          BOOKING_STATES.FAILED,
        errorCode:
          "WATCHDOG_NO_EXTERNAL_TRANSACTION",
        errorMessage:
          "The watchdog confirmed no Authorize.Net transaction and no Bookeo booking.",
      });
    }

    /*
     * A Bookeo booking without a persisted or discoverable
     * Authorize.Net transaction is abnormal. Do not tell the
     * customer success or failure until payment state can be
     * positively determined.
     */
    if (
      !transactionId &&
      bookingId
    ) {
      await updateBookingLedgerRecord({
        checkoutId,
        errorCode:
          "WATCHDOG_BOOKEO_WITHOUT_AUTHNET_ID",
        errorMessage:
          "Bookeo contains the booking, but no Authorize.Net transaction could be positively identified.",
        errorData: {
          bookeoBookingId:
            bookingId,
        },
      });

      return pendingResponse(
        "The reservation exists, but payment status still requires verification."
      );
    }

    const gatewayState =
      await getAuthorizeTransactionState(
        transactionId
      );

    if (!gatewayState.ok) {
      return pendingResponse(
        "Authorize.Net could not be reached to verify the payment."
      );
    }

    /*
     * Both systems positively agree: booking exists and
     * money is captured. This is a successful checkout.
     */
    if (
      bookingId &&
      CAPTURED_STATUSES.has(
        gatewayState.status
      )
    ) {
      await updateBookingLedgerRecord({
        checkoutId,
        authorizeTransactionId:
          transactionId,
        bookeoBookingId:
          bookingId,
      });

      const sessionAmount =
        Number(session.total);
      const gatewayAmount =
        gatewayState.settledAmount &&
        gatewayState.settledAmount > 0
          ? gatewayState.settledAmount
          : gatewayState.authorizedAmount;
      const amount =
        Number.isFinite(sessionAmount) &&
        sessionAmount > 0
          ? sessionAmount
          : gatewayAmount;

      if (
        amount !== null &&
        Number.isFinite(amount) &&
        amount > 0
      ) {
        const paymentSync =
          await ensureBookeoPaymentRecorded({
            checkoutId,
            bookingNumber:
              bookingId,
            transactionId,
            amount,
          });

        if (paymentSync.ok) {
          await markBookingCaptureComplete(
            checkoutId
          );
        } else {
          await updateBookingLedgerRecord({
            checkoutId,
            status:
              BOOKING_STATES.BOOKED,
            errorCode:
              "BOOKEO_PAYMENT_SYNC_PENDING",
            errorMessage:
              paymentSync.message,
            errorData: {
              authorizeTransactionId:
                transactionId,
              bookeoBookingId:
                bookingId,
              amount,
              captured: true,
              uncertain:
                paymentSync.uncertain,
            },
          });
        }
      } else {
        await updateBookingLedgerRecord({
          checkoutId,
          status:
            BOOKING_STATES.BOOKED,
          errorCode:
            "BOOKEO_PAYMENT_SYNC_AMOUNT_MISSING",
          errorMessage:
            "Captured payment was confirmed, but no usable amount was available for Bookeo payment synchronization.",
        });
      }

      await clearBookingWatchdogTakeover(
        checkoutId
      );

      logBookingEvent(
        "watchdog.confirmed_success",
        {
          sessionId,
          checkoutId,
          holdId:
            holdId || null,
          authorizeTransactionId:
            transactionId,
          bookeoBookingId:
            bookingId,
          result:
            gatewayState.status,
        }
      );

      return NextResponse.json({
        status: "confirmed",
        bookingId,
      });
    }

    /*
     * Bookeo exists but payment is only authorized.
     * Our agreed timeout policy is to unwind instead of
     * starting a new capture after watchdog takeover.
     */
    if (
      bookingId &&
      gatewayState.status ===
        AUTHORIZED_PENDING_CAPTURE
    ) {
      const voidResult =
        await voidAuthorizeAuthorization(
          transactionId
        );

      if (!voidResult.ok) {
        await updateBookingLedgerRecord({
          checkoutId,
          errorCode:
            "WATCHDOG_VOID_UNCONFIRMED",
          errorMessage:
            voidResult.message,
          errorData: {
            authorizeTransactionId:
              transactionId,
            bookeoBookingId:
              bookingId,
            uncertain:
              voidResult.uncertain,
          },
        });

        return pendingResponse(
          "The payment reversal is still being verified."
        );
      }

      return cancelBookingThenFail({
        session,
        checkoutId,
        holdId,
        bookingId,
        errorCode:
          "WATCHDOG_AUTH_VOIDED_BOOKING_CANCELED",
        errorMessage:
          "The timed-out checkout was unwound: authorization voided and Bookeo booking canceled.",
      });
    }

    /*
     * No booking exists, but an authorization does.
     * Void it, release the hold, and fail cleanly.
     */
    if (
      !bookingId &&
      gatewayState.status ===
        AUTHORIZED_PENDING_CAPTURE
    ) {
      const voidResult =
        await voidAuthorizeAuthorization(
          transactionId
        );

      if (!voidResult.ok) {
        await updateBookingLedgerRecord({
          checkoutId,
          errorCode:
            "WATCHDOG_ORPHAN_AUTH_VOID_UNCONFIRMED",
          errorMessage:
            voidResult.message,
          errorData: {
            authorizeTransactionId:
              transactionId,
            uncertain:
              voidResult.uncertain,
          },
        });

        return pendingResponse(
          "The payment reversal is still being verified."
        );
      }

      return finishFailure({
        session,
        checkoutId,
        holdId,
        terminalStatus:
          BOOKING_STATES.VOIDED,
        errorCode:
          "WATCHDOG_ORPHAN_AUTH_VOIDED",
        errorMessage:
          "The timed-out checkout had no Bookeo booking and the Authorize.Net authorization was voided.",
      });
    }

    /*
     * Captured/Pending Settlement is still unsettled and
     * can be voided. This branch is not expected under the
     * normal architecture, but it closes the orphan-charge
     * edge case without inviting a second payment.
     */
    if (
      !bookingId &&
      gatewayState.status ===
        "capturedPendingSettlement"
    ) {
      const voidResult =
        await voidAuthorizeAuthorization(
          transactionId
        );

      if (!voidResult.ok) {
        await updateBookingLedgerRecord({
          checkoutId,
          errorCode:
            "WATCHDOG_CAPTURED_ORPHAN_VOID_UNCONFIRMED",
          errorMessage:
            voidResult.message,
          errorData: {
            authorizeTransactionId:
              transactionId,
            gatewayStatus:
              gatewayState.status,
            uncertain:
              voidResult.uncertain,
          },
        });

        return pendingResponse(
          "The payment reversal is still being verified."
        );
      }

      return finishFailure({
        session,
        checkoutId,
        holdId,
        terminalStatus:
          BOOKING_STATES.VOIDED,
        errorCode:
          "WATCHDOG_CAPTURED_ORPHAN_VOIDED",
        errorMessage:
          "The watchdog found a captured but unsettled payment without a Bookeo booking and confirmed the transaction was voided.",
      });
    }

    /*
     * A settled payment without a Bookeo booking cannot
     * be voided. Never claim failure here because a refund
     * would have to be positively completed first.
     */
    if (
      !bookingId &&
      gatewayState.status ===
        "settledSuccessfully"
    ) {
      await updateBookingLedgerRecord({
        checkoutId,
        errorCode:
          "WATCHDOG_SETTLED_WITHOUT_BOOKEO",
        errorMessage:
          "Authorize.Net reports a settled payment but Bookeo has no matching booking. Manual refund/review is required.",
        errorData: {
          authorizeTransactionId:
            transactionId,
        },
      });

      return pendingResponse(
        "Payment was received and the reservation requires additional verification."
      );
    }

    /*
     * AuthNet already says the transaction cannot settle.
     * If a Bookeo booking exists, cancel it first.
     */
    if (
      VOIDED_STATUSES.has(
        gatewayState.status
      )
    ) {
      if (bookingId) {
        return cancelBookingThenFail({
          session,
          checkoutId,
          holdId,
          bookingId,
          errorCode:
            "WATCHDOG_NONPAYABLE_BOOKING_CANCELED",
          errorMessage:
            `Authorize.Net reports ${gatewayState.status}; the Bookeo booking was canceled.`,
        });
      }

      return finishFailure({
        session,
        checkoutId,
        holdId,
        terminalStatus:
          gatewayState.status ===
          "voided"
            ? BOOKING_STATES.VOIDED
            : BOOKING_STATES.FAILED,
        errorCode:
          "WATCHDOG_NONPAYABLE_NO_BOOKING",
        errorMessage:
          `Authorize.Net reports ${gatewayState.status} and no Bookeo booking exists.`,
      });
    }

    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "WATCHDOG_UNHANDLED_GATEWAY_STATUS",
      errorMessage:
        `The watchdog could not safely resolve Authorize.Net status ${gatewayState.status}.`,
      errorData: {
        authorizeTransactionId:
          transactionId,
        bookeoBookingId:
          bookingId || null,
        gatewayStatus:
          gatewayState.status,
      },
    });

    return pendingResponse(
      "The transaction still requires verification."
    );
  } catch (error) {
    console.error(
      "BOOKING WATCHDOG ERROR",
      error
    );

    return NextResponse.json(
      {
        status: "pending",
        error:
          "The booking status could not be verified yet.",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (resolverCheckoutId) {
      try {
        await releaseBookingWatchdogResolver(
          resolverCheckoutId,
          resolverRequestId
        );
      } catch (error) {
        console.error(
          "Could not release booking watchdog resolver ownership.",
          error
        );
      }
    }
  }
}
