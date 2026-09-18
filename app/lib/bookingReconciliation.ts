import "server-only";

import { Redis } from "@upstash/redis";
import { Resend } from "resend";

import {
  type BookingSession,
} from "@/app/lib/booking";
import {
  getSandboxTransactionState,
} from "@/app/lib/authorizeSandbox";
import {
  lookupFinalBookeoBooking,
} from "@/app/lib/bookeoBookingLookup";
import {
  markBookingCaptureComplete,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";
import {
  recoverFailedCapture,
} from "@/app/lib/captureRecovery";

const redis = Redis.fromEnv();

const CAPTURED_STATUSES =
  new Set([
    "capturedPendingSettlement",
    "settledSuccessfully",
  ]);

const AUTHORIZED_PENDING_CAPTURE =
  "authorizedPendingCapture";

const VOIDED_STATUS =
  "voided";

const RECONCILIATION_ALERT_TTL_SECONDS =
  60 * 60 * 24 * 30;

type LedgerRow = {
  checkout_id?: string;
  checkoutId?: string;
  authorize_transaction_id?: string;
  authorizeTransactionId?: string;
  bookeo_booking_id?: string | null;
  bookeoBookingId?: string | null;
  status?: string;
};

export type BookingReconciliationResult = {
  ok: boolean;
  checkoutId: string;
  action:
    | "NO_CHANGE"
    | "MARKED_COMPLETE"
    | "BOOKEO_FOUND_AND_COMPLETE"
    | "BOOKEO_FOUND_AND_CAPTURED"
    | "CAPTURE_RECOVERED"
    | "MARKED_VOIDED"
    | "MANUAL_REVIEW"
    | "SKIPPED";
  message?: string;
};

function getCheckoutId(
  row: LedgerRow
) {
  return String(
    row.checkout_id ||
    row.checkoutId ||
    ""
  ).trim();
}

function getTransactionId(
  row: LedgerRow
) {
  return String(
    row.authorize_transaction_id ||
    row.authorizeTransactionId ||
    ""
  ).trim();
}

function getBookeoBookingId(
  row: LedgerRow
) {
  return String(
    row.bookeo_booking_id ||
    row.bookeoBookingId ||
    ""
  ).trim();
}

async function sendReconciliationAlert({
  checkoutId,
  transactionId,
  code,
  message,
}: {
  checkoutId: string;
  transactionId: string;
  code: string;
  message: string;
}) {
  const resendApiKey =
    process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error(
      "Booking reconciliation alert could not be sent because RESEND_API_KEY is missing.",
      {
        checkoutId,
        transactionId,
        code,
      }
    );

    return false;
  }

  const alertKey =
    `booking-reconciliation-alert:${checkoutId}:${code}`;

  const claimed =
    await redis.set(
      alertKey,
      "1",
      {
        nx: true,
        ex:
          RECONCILIATION_ALERT_TTL_SECONDS,
      }
    );

  if (claimed !== "OK") {
    return true;
  }

  try {
    const resend =
      new Resend(resendApiKey);

    await resend.emails.send({
      from:
        "Escape Room Mystery <info@escaperoommystery.com>",
      to:
        ["info@escaperoommystery.com"],
      subject:
        "URGENT: Booking reconciliation needs review",
      text:
        `The booking-v2 reconciliation process found a mismatch that was not safe to repair automatically.

Checkout: ${checkoutId}
Authorize.Net transaction: ${transactionId}
Code: ${code}

${message}

Do not create another Bookeo booking or capture/void payment manually until Authorize.Net and Bookeo are checked.`,
    });

    return true;
  } catch (error) {
    await redis.del(alertKey);

    console.error(
      "Booking reconciliation alert email failed.",
      {
        checkoutId,
        transactionId,
        code,
        reason:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );

    return false;
  }
}

async function markManualReview({
  checkoutId,
  transactionId,
  errorCode,
  errorMessage,
  errorData,
  alert = true,
}: {
  checkoutId: string;
  transactionId: string;
  errorCode: string;
  errorMessage: string;
  errorData?: unknown;
  alert?: boolean;
}) {
  await updateBookingLedgerRecord({
    checkoutId,
    errorCode,
    errorMessage,
    errorData,
  });

  if (alert) {
    await sendReconciliationAlert({
      checkoutId,
      transactionId,
      code:
        errorCode,
      message:
        errorMessage,
    });
  }

  return {
    ok: false,
    checkoutId,
    action:
      "MANUAL_REVIEW" as const,
    message:
      errorMessage,
  };
}

async function loadBookingSession(
  checkoutId: string
) {
  /*
   * booking-v2 uses the ERM checkout/session ID as
   * the booking-session key. The session contains
   * the trusted product/event/date/location fields
   * needed for a read-only Bookeo lookup.
   */
  return redis.get<BookingSession>(
    `booking-session:${checkoutId}`
  );
}

export async function reconcileBookingLedgerRow(
  row: LedgerRow
): Promise<BookingReconciliationResult> {
  const checkoutId =
    getCheckoutId(row);

  const transactionId =
    getTransactionId(row);

  const ledgerStatus =
    String(
      row.status || ""
    );

  let bookeoBookingId =
    getBookeoBookingId(row);

  if (
    !checkoutId ||
    !transactionId
  ) {
    return {
      ok: false,
      checkoutId,
      action: "SKIPPED",
      message:
        "Ledger row is missing checkout or Authorize.Net transaction ID.",
    };
  }

  const gatewayState =
    await getSandboxTransactionState(
      transactionId
    );

  if (!gatewayState.ok) {
    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "RECONCILE_AUTHNET_STATE_UNCONFIRMED",
      errorMessage:
        gatewayState.message,
      errorData: {
        transactionId,
        uncertain:
          gatewayState.uncertain,
      },
    });

    return {
      ok: false,
      checkoutId,
      action: "NO_CHANGE",
      message:
        gatewayState.message,
    };
  }

  /*
   * If Postgres already has a confirmed Bookeo ID,
   * no Bookeo search is necessary.
   */
  if (bookeoBookingId) {
    if (
      CAPTURED_STATUSES.has(
        gatewayState.status
      )
    ) {
      await markBookingCaptureComplete(
        checkoutId
      );

      return {
        ok: true,
        checkoutId,
        action:
          "MARKED_COMPLETE",
      };
    }

    if (
      gatewayState.status ===
      AUTHORIZED_PENDING_CAPTURE
    ) {
      const amount =
        gatewayState.authorizedAmount;

      if (
        amount === null ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return markManualReview({
          checkoutId,
          transactionId,
          errorCode:
            "RECONCILE_CAPTURE_AMOUNT_MISSING",
          errorMessage:
            "Bookeo is confirmed, but Authorize.Net did not return a usable authorized amount for safe capture recovery.",
          errorData: {
            gatewayStatus:
              gatewayState.status,
            bookeoBookingId,
          },
        });
      }

      if (
        ledgerStatus !==
        BOOKING_STATES.BOOKED &&
        ledgerStatus !==
        BOOKING_STATES.CAPTURE_FAILED
      ) {
        await updateBookingLedgerRecord({
          checkoutId,
          status:
            BOOKING_STATES.BOOKED,
          bookeoBookingId,
        });
      }

      const captureRecovery =
        await recoverFailedCapture({
          checkoutId,
          transactionId,
          bookeoBookingId,
          amount,
        });

      if (captureRecovery.ok) {
        return {
          ok: true,
          checkoutId,
          action:
            "CAPTURE_RECOVERED",
        };
      }

      return {
        ok: false,
        checkoutId,
        action:
          "MANUAL_REVIEW",
        message:
          captureRecovery.message,
      };
    }

    if (
      gatewayState.status ===
      VOIDED_STATUS
    ) {
      return markManualReview({
        checkoutId,
        transactionId,
        errorCode:
          "RECONCILE_VOIDED_WITH_BOOKEO",
        errorMessage:
          "Authorize.Net reports the transaction voided, but Postgres contains a confirmed Bookeo booking.",
        errorData: {
          gatewayStatus:
            gatewayState.status,
          ledgerStatus,
          bookeoBookingId,
        },
      });
    }

    return markManualReview({
      checkoutId,
      transactionId,
      errorCode:
        "RECONCILE_UNHANDLED_AUTHNET_STATUS",
      errorMessage:
        `Bookeo is confirmed, but Authorize.Net reports ${gatewayState.status}.`,
      errorData: {
        gatewayStatus:
          gatewayState.status,
        ledgerStatus,
        bookeoBookingId,
      },
    });
  }

  /*
   * Postgres does not know a Bookeo booking number.
   * Read the trusted booking session and perform the
   * same exact externalRef lookup used by the normal
   * finalization flow. This lookup NEVER creates a
   * Bookeo booking.
   */
  const session =
    await loadBookingSession(
      checkoutId
    );

  if (!session) {
    return markManualReview({
      checkoutId,
      transactionId,
      errorCode:
        "RECONCILE_BOOKING_SESSION_MISSING",
      errorMessage:
        "Reconciliation needs a Bookeo lookup, but the trusted booking session is no longer available.",
      errorData: {
        gatewayStatus:
          gatewayState.status,
        ledgerStatus,
      },
      alert:
        CAPTURED_STATUSES.has(
          gatewayState.status
        ),
    });
  }

  const lookupResult =
    await lookupFinalBookeoBooking(
      session
    );

  if (!lookupResult.ok) {
    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "RECONCILE_BOOKEO_LOOKUP_FAILED",
      errorMessage:
        lookupResult.message,
      errorData: {
        gatewayStatus:
          gatewayState.status,
        ledgerStatus,
      },
    });

    return {
      ok: false,
      checkoutId,
      action:
        "NO_CHANGE",
      message:
        lookupResult.message,
    };
  }

  if (
    lookupResult.result ===
    "AMBIGUOUS"
  ) {
    return markManualReview({
      checkoutId,
      transactionId,
      errorCode:
        "RECONCILE_MULTIPLE_BOOKEO_MATCHES",
      errorMessage:
        "Multiple Bookeo bookings matched the unique checkout externalRef. Automatic reconciliation stopped.",
      errorData: {
        matches:
          lookupResult.matches,
        gatewayStatus:
          gatewayState.status,
        ledgerStatus,
      },
    });
  }

  if (
    lookupResult.result ===
    "NO_MATCH"
  ) {
    if (
      gatewayState.status ===
      VOIDED_STATUS
    ) {
      await updateBookingLedgerRecord({
        checkoutId,
        status:
          BOOKING_STATES.VOIDED,
        errorCode:
          "RECONCILE_CONFIRMED_VOID_NO_BOOKEO",
        errorMessage:
          "Authorize.Net reports voided and Bookeo lookup found no booking.",
        errorData: {
          gatewayStatus:
            gatewayState.status,
        },
      });

      return {
        ok: true,
        checkoutId,
        action:
          "MARKED_VOIDED",
      };
    }

    if (
      CAPTURED_STATUSES.has(
        gatewayState.status
      )
    ) {
      return markManualReview({
        checkoutId,
        transactionId,
        errorCode:
          "RECONCILE_CAPTURED_WITHOUT_BOOKEO",
        errorMessage:
          "Authorize.Net reports captured payment, but the read-only Bookeo lookup found no matching booking.",
        errorData: {
          gatewayStatus:
            gatewayState.status,
          ledgerStatus,
        },
      });
    }

    if (
      gatewayState.status ===
      AUTHORIZED_PENDING_CAPTURE
    ) {
      /*
       * Do not create Bookeo and do not capture.
       * The synchronous flow owns the controlled
       * CREATE attempts. Delayed reconciliation is
       * read-only with respect to Bookeo.
       */
      await updateBookingLedgerRecord({
        checkoutId,
        errorCode:
          "RECONCILE_AUTHORIZED_WITHOUT_BOOKEO",
        errorMessage:
          "Authorize.Net is still authorized, but Bookeo lookup found no matching booking. No capture or Bookeo creation was attempted.",
        errorData: {
          gatewayStatus:
            gatewayState.status,
          ledgerStatus,
        },
      });

      return {
        ok: false,
        checkoutId,
        action:
          "NO_CHANGE",
        message:
          "Authorization remains open without a confirmed Bookeo booking.",
      };
    }

    return markManualReview({
      checkoutId,
      transactionId,
      errorCode:
        "RECONCILE_NO_BOOKEO_UNHANDLED_AUTHNET_STATUS",
      errorMessage:
        `Bookeo lookup found no booking and Authorize.Net reports ${gatewayState.status}.`,
      errorData: {
        gatewayStatus:
          gatewayState.status,
        ledgerStatus,
      },
    });
  }

  /*
   * Exactly one Bookeo booking was positively found.
   */
  bookeoBookingId =
    lookupResult.bookingId;

  await updateBookingLedgerRecord({
    checkoutId,
    bookeoBookingId,
    status:
      BOOKING_STATES.BOOKED,
  });

  if (
    CAPTURED_STATUSES.has(
      gatewayState.status
    )
  ) {
    await markBookingCaptureComplete(
      checkoutId
    );

    return {
      ok: true,
      checkoutId,
      action:
        "BOOKEO_FOUND_AND_COMPLETE",
    };
  }

  if (
    gatewayState.status ===
    AUTHORIZED_PENDING_CAPTURE
  ) {
    const amount =
      gatewayState.authorizedAmount;

    if (
      amount === null ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return markManualReview({
        checkoutId,
        transactionId,
        errorCode:
          "RECONCILE_CAPTURE_AMOUNT_MISSING",
        errorMessage:
          "Bookeo was found, but Authorize.Net did not return a usable authorized amount for safe capture recovery.",
        errorData: {
          gatewayStatus:
            gatewayState.status,
          bookeoBookingId,
        },
      });
    }

    const captureRecovery =
      await recoverFailedCapture({
        checkoutId,
        transactionId,
        bookeoBookingId,
        amount,
      });

    if (captureRecovery.ok) {
      return {
        ok: true,
        checkoutId,
        action:
          "BOOKEO_FOUND_AND_CAPTURED",
      };
    }

    return {
      ok: false,
      checkoutId,
      action:
        "MANUAL_REVIEW",
      message:
        captureRecovery.message,
    };
  }

  if (
    gatewayState.status ===
    VOIDED_STATUS
  ) {
    return markManualReview({
      checkoutId,
      transactionId,
      errorCode:
        "RECONCILE_VOIDED_WITH_DISCOVERED_BOOKEO",
      errorMessage:
        "Bookeo lookup found a booking, but Authorize.Net reports the transaction voided.",
      errorData: {
        gatewayStatus:
          gatewayState.status,
        bookeoBookingId,
      },
    });
  }

  return markManualReview({
    checkoutId,
    transactionId,
    errorCode:
      "RECONCILE_DISCOVERED_BOOKEO_UNHANDLED_AUTHNET_STATUS",
    errorMessage:
      `Bookeo lookup found a booking, but Authorize.Net reports ${gatewayState.status}.`,
    errorData: {
      gatewayStatus:
        gatewayState.status,
      bookeoBookingId,
    },
  });
}
