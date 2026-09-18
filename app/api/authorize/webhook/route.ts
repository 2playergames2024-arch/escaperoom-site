import { NextResponse } from "next/server";
import {
  createHmac,
  timingSafeEqual,
} from "crypto";

import {
  getSandboxTransactionState,
} from "@/app/lib/authorizeSandbox";
import {
  getBookingLedgerRecordByAuthorizeTransactionId,
  markBookingCaptureComplete,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";

const HANDLED_PAYMENT_EVENTS =
  new Set([
    "net.authorize.payment.authorization.created",
    "net.authorize.payment.priorAuthCapture.created",
    "net.authorize.payment.authcapture.created",
    "net.authorize.payment.void.created",
  ]);

const CAPTURED_STATUSES =
  new Set([
    "capturedPendingSettlement",
    "settledSuccessfully",
  ]);

const AUTHORIZED_STATUS =
  "authorizedPendingCapture";

const VOIDED_STATUS =
  "voided";

function verifyWebhookSignature({
  rawBodyBuffer,
  receivedSignature,
  signatureKey,
}: {
  rawBodyBuffer: Buffer;
  receivedSignature: string;
  signatureKey: string;
}) {
  const normalizedSignature =
    receivedSignature
      .replace(/^sha512=/i, "")
      .trim()
      .toLowerCase();

  if (
    !/^[0-9a-f]{128}$/i.test(
      normalizedSignature
    )
  ) {
    return false;
  }

  const calculatedSignature =
    createHmac(
      "sha512",
      signatureKey.trim()
    )
      .update(rawBodyBuffer)
      .digest("hex")
      .toLowerCase();

  const receivedBuffer =
    Buffer.from(
      normalizedSignature,
      "hex"
    );

  const calculatedBuffer =
    Buffer.from(
      calculatedSignature,
      "hex"
    );

  return (
    receivedBuffer.length ===
      calculatedBuffer.length &&
    timingSafeEqual(
      receivedBuffer,
      calculatedBuffer
    )
  );
}

export async function POST(
  request: Request
) {
  try {
    /*
     * booking-v2 Preview uses its own sandbox
     * Signature Key. Production credentials are
     * deliberately not used here.
     */
    const signatureKey =
      process.env
        .AUTHORIZE_SANDBOX_SIGNATURE_KEY;

    if (!signatureKey) {
      console.error(
        "AUTHORIZE_SANDBOX_SIGNATURE_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "Webhook verification is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * Verify the exact raw bytes before parsing.
     */
    const rawBodyBuffer =
      Buffer.from(
        await request.arrayBuffer()
      );

    const receivedSignature =
      request.headers.get(
        "x-anet-signature"
      ) || "";

    if (
      !receivedSignature ||
      !verifyWebhookSignature({
        rawBodyBuffer,
        receivedSignature,
        signatureKey,
      })
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid webhook signature.",
        },
        {
          status: 401,
        }
      );
    }

    const body = JSON.parse(
      rawBodyBuffer.toString("utf8")
    );

    const eventType = String(
      body?.eventType || ""
    );

    const transactionId = String(
      body?.payload?.id || ""
    ).trim();

    /*
     * Ignore unrelated Authorize.Net events.
     * They are still acknowledged successfully.
     */
    if (
      !HANDLED_PAYMENT_EVENTS.has(
        eventType
      )
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    if (!transactionId) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    /*
     * The webhook payload is only a notification.
     * Match by the AuthNet transaction ID already
     * stored in Postgres; never bind by browser data.
     */
    const ledgerLookup =
      await getBookingLedgerRecordByAuthorizeTransactionId(
        transactionId
      );

    if (
      ledgerLookup.kind ===
      "NOT_FOUND"
    ) {
      console.warn(
        "Authorize.Net webhook did not match a booking ledger transaction.",
        {
          eventType,
          transactionId,
        }
      );

      return NextResponse.json({
        received: true,
        unmatched: true,
      });
    }

    if (
      ledgerLookup.kind ===
      "AMBIGUOUS"
    ) {
      console.error(
        "Authorize.Net transaction ID matched multiple booking ledger rows.",
        {
          eventType,
          transactionId,
        }
      );

      return NextResponse.json(
        {
          received: true,
          reconciliationStopped:
            true,
        },
        {
          status: 409,
        }
      );
    }

    const ledger =
      ledgerLookup.record;

    if (!ledger) {
      return NextResponse.json(
        {
          received: true,
          reconciliationStopped:
            true,
        },
        {
          status: 409,
        }
      );
    }

    /*
     * Independently ask Authorize.Net for the
     * actual transaction state. Never trust the
     * webhook event name alone to mutate money state.
     */
    const gatewayState =
      await getSandboxTransactionState(
        transactionId
      );

    if (!gatewayState.ok) {
      await updateBookingLedgerRecord({
        checkoutId:
          String(
            ledger.checkout_id ||
            ledger.checkoutId
          ),
        errorCode:
          "WEBHOOK_AUTHNET_STATE_UNCONFIRMED",
        errorMessage:
          gatewayState.message,
        errorData: {
          eventType,
          transactionId,
          uncertain:
            gatewayState.uncertain,
        },
      });

      /*
       * Return non-200 so Authorize.Net can retry
       * delivery. We did not reconcile anything.
       */
      return NextResponse.json(
        {
          error:
            "Authorize.Net transaction state could not be confirmed.",
        },
        {
          status: 502,
        }
      );
    }

    const checkoutId =
      String(
        ledger.checkout_id ||
        ledger.checkoutId
      );

    const currentStatus =
      String(
        ledger.status || ""
      );

    const bookeoBookingId =
      String(
        ledger.bookeo_booking_id ||
        ledger.bookeoBookingId ||
        ""
      );

    /*
     * Captured/settled money may only move our
     * ledger to COMPLETE if Bookeo is already
     * positively known to exist.
     *
     * The webhook NEVER creates a Bookeo booking.
     */
    if (
      CAPTURED_STATUSES.has(
        gatewayState.status
      )
    ) {
      if (
        currentStatus ===
          BOOKING_STATES.COMPLETE
      ) {
        return NextResponse.json({
          received: true,
          reconciled: true,
          alreadyComplete: true,
        });
      }

      if (
        bookeoBookingId &&
        (
          currentStatus ===
            BOOKING_STATES.BOOKED ||
          currentStatus ===
            BOOKING_STATES.CAPTURE_FAILED
        )
      ) {
        await markBookingCaptureComplete(
          checkoutId
        );

        return NextResponse.json({
          received: true,
          reconciled: true,
          status:
            BOOKING_STATES.COMPLETE,
        });
      }

      /*
       * Captured money without a confirmed Bookeo
       * booking is not safe to auto-resolve here.
       * Preserve state for Step 26 reconciliation.
       */
      await updateBookingLedgerRecord({
        checkoutId,
        errorCode:
          "WEBHOOK_CAPTURED_WITHOUT_CONFIRMED_BOOKEO",
        errorMessage:
          "Authorize.Net reports captured payment, but Postgres does not contain a confirmed Bookeo booking.",
        errorData: {
          eventType,
          transactionId,
          gatewayStatus:
            gatewayState.status,
          ledgerStatus:
            currentStatus,
        },
      });

      return NextResponse.json({
        received: true,
        reconciliationRequired: true,
      });
    }

    /*
     * Authorization-only events are informational.
     * The synchronous payment route owns normal
     * AUTHORIZED progression and Bookeo creation.
     */
    if (
      gatewayState.status ===
      AUTHORIZED_STATUS
    ) {
      return NextResponse.json({
        received: true,
        reconciled: true,
        status:
          currentStatus,
      });
    }

    /*
     * A confirmed void may safely reconcile a
     * non-booked authorization to VOIDED.
     * Never overwrite COMPLETE, BOOKED, or
     * CAPTURE_FAILED automatically.
     */
    if (
      gatewayState.status ===
      VOIDED_STATUS
    ) {
      if (
        currentStatus ===
          BOOKING_STATES.AUTHORIZED ||
        currentStatus ===
          BOOKING_STATES.AUTHORIZING
      ) {
        await updateBookingLedgerRecord({
          checkoutId,
          status:
            BOOKING_STATES.VOIDED,
          errorCode:
            "WEBHOOK_CONFIRMED_VOID",
          errorMessage:
            "Authorize.Net webhook reconciliation confirmed that the authorization was voided.",
          errorData: {
            eventType,
            transactionId,
            gatewayStatus:
              gatewayState.status,
          },
        });

        return NextResponse.json({
          received: true,
          reconciled: true,
          status:
            BOOKING_STATES.VOIDED,
        });
      }

      return NextResponse.json({
        received: true,
        reconciled: true,
        status:
          currentStatus,
      });
    }

    /*
     * Unknown/other terminal statuses are recorded
     * for later reconciliation but never cause a
     * Bookeo action or a blind payment action.
     */
    await updateBookingLedgerRecord({
      checkoutId,
      errorCode:
        "WEBHOOK_UNHANDLED_AUTHNET_STATUS",
      errorMessage:
        `Authorize.Net webhook reconciliation returned status ${gatewayState.status}.`,
      errorData: {
        eventType,
        transactionId,
        gatewayStatus:
          gatewayState.status,
        ledgerStatus:
          currentStatus,
      },
    });

    return NextResponse.json({
      received: true,
      reconciliationRequired: true,
    });
  } catch (error) {
    console.error(
      "AUTHORIZE.NET BOOKING-V2 WEBHOOK ERROR",
      {
        reason:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing failed.",
      },
      {
        status: 500,
      }
    );
  }
}
