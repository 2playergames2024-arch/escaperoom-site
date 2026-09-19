import "server-only";

import { Redis } from "@upstash/redis";
import { Resend } from "resend";

import {
  captureAuthorizeAuthorization,
  getAuthorizeTransactionState,
} from "@/app/lib/authorizeSandbox";
import {
  markBookingCaptureComplete,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";

const redis = Redis.fromEnv();

const resend =
  new Resend(
    process.env.RESEND_API_KEY
  );

const CAPTURED_STATUSES =
  new Set([
    "capturedPendingSettlement",
    "settledSuccessfully",
  ]);

const AUTHORIZED_PENDING_CAPTURE =
  "authorizedPendingCapture";

const MAX_CAPTURE_RETRIES = 2;

type CaptureRecoverySuccess = {
  ok: true;
  transactionId: string;
  recoveredBy:
    | "status_check"
    | "retry_capture";
  retryAttempts: number;
};

type CaptureRecoveryFailure = {
  ok: false;
  message: string;
  finalStatus: string | null;
  retryAttempts: number;
  alertSent: boolean;
};

export type CaptureRecoveryResult =
  | CaptureRecoverySuccess
  | CaptureRecoveryFailure;

function sleep(
  milliseconds: number
) {
  return new Promise<void>(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

async function sendCaptureRecoveryAlert({
  checkoutId,
  transactionId,
  bookeoBookingId,
  amount,
  finalStatus,
  message,
  retryAttempts,
}: {
  checkoutId: string;
  transactionId: string;
  bookeoBookingId: string;
  amount: number;
  finalStatus: string | null;
  message: string;
  retryAttempts: number;
}) {
  const alertKey =
    `capture-recovery-alert-sent:${checkoutId}`;

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
    return true;
  }

  if (!process.env.RESEND_API_KEY) {
    await redis.del(
      alertKey
    );

    console.error(
      "Capture recovery alert could not be sent because RESEND_API_KEY is not configured.",
      {
        checkoutId,
        transactionId,
      }
    );

    return false;
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
          "URGENT: Booked reservation payment capture needs recovery",

        text: `
A Bookeo booking exists, but Authorize.Net capture recovery was exhausted.

ACTION REQUIRED:
Verify the Authorize.Net transaction before taking any payment action.
Do not issue another capture unless Authorize.Net still shows Authorized/Pending Capture.

Checkout ID: ${checkoutId}
Authorize.Net transaction: ${transactionId}
Bookeo booking: ${bookeoBookingId}
Amount: $${amount.toFixed(2)}
Final Authorize.Net status: ${finalStatus || "unknown"}
Automatic capture retries attempted: ${retryAttempts}

Last recovery result:
${message}
        `.trim(),
      });

    if (error) {
      throw new Error(
        "Capture recovery alert email failed."
      );
    }

    return true;
  } catch (error) {
    await redis.del(
      alertKey
    );

    console.error(
      "Failed to send capture recovery alert.",
      {
        checkoutId,
        transactionId,
        error:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );

    return false;
  }
}

async function markComplete(
  checkoutId: string
) {
  await markBookingCaptureComplete(
    checkoutId
  );
}

export async function recoverFailedCapture({
  checkoutId,
  transactionId,
  bookeoBookingId,
  amount,
}: {
  checkoutId: string;
  transactionId: string;
  bookeoBookingId: string;
  amount: number;
}): Promise<CaptureRecoveryResult> {
  let retryAttempts = 0;
  let finalStatus:
    string | null = null;
  let lastMessage =
    "Capture recovery did not complete.";

  /*
   * Safeguard:
   * every retry is preceded by an independent
   * Authorize.Net transaction-state lookup.
   *
   * We never infer "not captured" from a failed
   * or timed-out capture request.
   */
  for (
    let recoveryRound = 1;
    recoveryRound <=
      MAX_CAPTURE_RETRIES;
    recoveryRound++
  ) {
    await sleep(
      recoveryRound === 1
        ? 500
        : 1000
    );

    const state =
      await getAuthorizeTransactionState(
        transactionId
      );

    if (!state.ok) {
      lastMessage =
        state.message;

      await updateBookingLedgerRecord({
        checkoutId,
        status:
          BOOKING_STATES.CAPTURE_FAILED,
        errorCode:
          `CAPTURE_STATUS_CHECK_${recoveryRound}_FAILED`,
        errorMessage:
          state.message,
        errorData: {
          authorizeTransactionId:
            transactionId,
          bookeoBookingId,
          recoveryRound,
          retryAttempts,
          uncertain:
            state.uncertain,
        },
      });

      /*
       * No retry is allowed because the gateway
       * state was not confirmed.
       *
       * A later recovery round gets one more
       * chance to obtain the state.
       */
      continue;
    }

    finalStatus =
      state.status;

    if (
      CAPTURED_STATUSES.has(
        state.status
      )
    ) {
      await markComplete(
        checkoutId
      );

      return {
        ok: true,
        transactionId:
          state.transactionId,
        recoveredBy:
          "status_check",
        retryAttempts,
      };
    }

    if (
      state.status !==
      AUTHORIZED_PENDING_CAPTURE
    ) {
      lastMessage =
        `Authorize.Net transaction status is ${state.status}; automatic capture retry is not permitted.`;

      break;
    }

    /*
     * We have now independently confirmed that
     * the transaction is still authorized and
     * uncaptured. Only now is a retry allowed.
     */
    retryAttempts++;

    const retryResult =
      await captureAuthorizeAuthorization(
        transactionId,
        amount
      );

    if (retryResult.ok) {
      await markComplete(
        checkoutId
      );

      return {
        ok: true,
        transactionId:
          retryResult.transactionId,
        recoveredBy:
          "retry_capture",
        retryAttempts,
      };
    }

    lastMessage =
      retryResult.message;

    await updateBookingLedgerRecord({
      checkoutId,
      status:
        BOOKING_STATES.CAPTURE_FAILED,
      errorCode:
        retryResult.uncertain
          ? `CAPTURE_RETRY_${retryAttempts}_UNCERTAIN`
          : `CAPTURE_RETRY_${retryAttempts}_REJECTED`,
      errorMessage:
        retryResult.message,
      errorData: {
        authorizeTransactionId:
          transactionId,
        bookeoBookingId,
        retryAttempts,
        gatewayStatusBeforeRetry:
          state.status,
        uncertain:
          retryResult.uncertain,
      },
    });

    /*
     * Do not immediately retry again.
     * The next loop begins with another
     * transaction-state verification.
     */
  }

  /*
   * Final verification before alerting.
   *
   * A capture response may have been lost even
   * though Authorize.Net accepted the capture.
   * If so, this converts the ledger to COMPLETE
   * instead of raising a false alarm.
   */
  const finalState =
    await getAuthorizeTransactionState(
      transactionId
    );

  if (finalState.ok) {
    finalStatus =
      finalState.status;

    if (
      CAPTURED_STATUSES.has(
        finalState.status
      )
    ) {
      await markComplete(
        checkoutId
      );

      return {
        ok: true,
        transactionId:
          finalState.transactionId,
        recoveredBy:
          "status_check",
        retryAttempts,
      };
    }

    lastMessage =
      finalState.status ===
      AUTHORIZED_PENDING_CAPTURE
        ? `Authorize.Net still reports ${AUTHORIZED_PENDING_CAPTURE} after ${retryAttempts} automatic capture retries.`
        : `Authorize.Net final transaction status is ${finalState.status}.`;
  } else {
    lastMessage =
      finalState.message;
  }

  await updateBookingLedgerRecord({
    checkoutId,
    status:
      BOOKING_STATES.CAPTURE_FAILED,
    errorCode:
      "CAPTURE_RECOVERY_EXHAUSTED",
    errorMessage:
      lastMessage,
    errorData: {
      authorizeTransactionId:
        transactionId,
      bookeoBookingId,
      amount,
      retryAttempts,
      finalStatus,
    },
  });

  /*
   * Staff alert happens only after all automatic
   * recovery attempts and the final verification
   * have been exhausted.
   */
  const alertSent =
    await sendCaptureRecoveryAlert({
      checkoutId,
      transactionId,
      bookeoBookingId,
      amount,
      finalStatus,
      message:
        lastMessage,
      retryAttempts,
    });

  return {
    ok: false,
    message:
      lastMessage,
    finalStatus,
    retryAttempts,
    alertSent,
  };
}
