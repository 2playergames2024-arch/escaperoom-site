import { after, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";
import {
  type BookingSession,
  type PaymentAttempt,
  type AuthorizeEvent,
  type DuplicatePaymentIncident,
  type OrphanPayment,
  isValidBookingSessionId,
} from "../../../lib/booking";

import { completePaidBooking } from "../../../lib/paymentCompletion";

const redis = Redis.fromEnv();

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const PAYMENT_STATE_TTL_SECONDS =
  60 * 60 * 24 * 30;

async function sendDuplicatePaymentAlert(
  incident: DuplicatePaymentIncident
) {
  const alertKey =
    `duplicate-payment-alert-sent:${incident.sessionId}:${incident.duplicateTransactionId}`;

  const claimed =
    await redis.set(
      alertKey,
      "1",
      {
        nx: true,
        ex:
          PAYMENT_STATE_TTL_SECONDS,
      }
    );

  if (claimed !== "OK") {
    return;
  }

  try {
    await resend.emails.send({
      from:
        "Escape Room Mystery <info@escaperoommystery.com>",
      to:
        "info@escaperoommystery.com",
      subject:
        "URGENT: Possible duplicate customer payment",
      text:
        `A second Authorize.Net payment event was received for the same booking session.

Session: ${incident.sessionId}
Original transaction: ${incident.originalTransactionId}
Additional transaction: ${incident.duplicateTransactionId}
Customer: ${incident.booking.firstName} ${incident.booking.lastName}
Email: ${incident.booking.email}
Phone: ${incident.booking.phone}
Location: ${incident.booking.location}
Room: ${incident.booking.roomName}
Date: ${incident.booking.date}
Time: ${incident.booking.time}
Amount: $${incident.booking.total}

Do not create another booking automatically from the additional transaction. Review both Authorize.Net transactions and the Bookeo booking state.`,
    });
  } catch (error) {
    await redis.del(
      alertKey
    );

    console.error(
      "Duplicate-payment alert email failed.",
      {
        sessionId:
          incident.sessionId,
        reason:
          error instanceof Error
            ? error.name
            : "unknown",
      }
    );
  }
}

export async function POST(req: Request) {
  try {
    const signatureKey =
      process.env.AUTHORIZE_SIGNATURE_KEY;

    if (!signatureKey) {
      console.error(
        "AUTHORIZE_SIGNATURE_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "Webhook verification is not configured.",
        },
        { status: 500 }
      );
    }

    /*
     * Read the exact webhook body bytes before parsing.
     */
    const rawBodyBuffer = Buffer.from(
      await req.arrayBuffer()
    );

    const rawBody =
      rawBodyBuffer.toString("utf8");

    const receivedSignature =
      req.headers.get("x-anet-signature") || "";

    if (!receivedSignature) {
      return NextResponse.json(
        { error: "Missing webhook signature." },
        { status: 401 }
      );
    }

    const normalizedSignature =
      receivedSignature
        .replace(/^sha512=/i, "")
        .trim()
        .toLowerCase();

    /*
     * IMPORTANT:
     * Authorize.net's actual webhook signature
     * matches HMAC-SHA512 when the 128-character
     * Signature Key is used as the literal key.
     */
    const calculatedSignature = createHmac(
      "sha512",
      signatureKey.trim()
    )
      .update(rawBodyBuffer)
      .digest("hex")
      .toLowerCase();

    /*
     * Validate that the received signature is
     * properly formatted before converting it.
     */
    if (
      !/^[0-9a-f]{128}$/i.test(
        normalizedSignature
      )
    ) {
      console.error(
        "AUTHORIZE.NET WEBHOOK SIGNATURE FORMAT INVALID"
      );

      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const receivedBuffer = Buffer.from(
      normalizedSignature,
      "hex"
    );

    const calculatedBuffer = Buffer.from(
      calculatedSignature,
      "hex"
    );

    if (
      receivedBuffer.length !==
      calculatedBuffer.length ||
      !timingSafeEqual(
        receivedBuffer,
        calculatedBuffer
      )
    ) {
      console.error(
        "AUTHORIZE.NET WEBHOOK SIGNATURE VERIFICATION FAILED"
      );

      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    /*
     * Signature is valid.
     * Only now do we parse and trust the body.
     */
    const body = JSON.parse(rawBody);

    const webhookReceivedAt =
      Date.now();

    console.info(
      "BOOKING_TIMELINE",
      {
        stage:
          "authorize_webhook_received",

        occurredAt:
          new Date(
            webhookReceivedAt
          ).toISOString(),

        eventType:
          String(
            body?.eventType || ""
          ),

        transactionId:
          String(
            body?.payload?.id || ""
          ),

        sessionId:
          String(
            body?.payload?.merchantReferenceId || ""
          ),
      }
    );

    const eventType = String(
      body?.eventType || ""
    );

    const transactionId = String(
      body?.payload?.id || ""
    );

    const sessionId = String(
      body?.payload?.merchantReferenceId || ""
    );

    /*
     * Only process the payment event we expect.
     */
    if (
      eventType !==
      "net.authorize.payment.authcapture.created"
    ) {
      return NextResponse.json({
        received: true,
      });
    }

    /*
     * Test webhooks and unrelated transactions
     * may not contain one of our ERM session IDs.
     * Acknowledge them without storing anything.
     */
    if (
      !transactionId ||
      !isValidBookingSessionId(
        sessionId
      )
    ) {
      return NextResponse.json({
        received: true,
      });
    }

    /*
     * A durable payment-attempt snapshot is created
     * before the customer is sent to Accept Hosted.
     * Use it even if the one-hour booking session has
     * expired by the time the signed webhook arrives.
     *
     * Backward compatibility: for an in-flight payment
     * created before this deployment, fall back to the
     * still-existing booking session and preserve it now.
     */
    const paymentAttemptKey =
      `payment-attempt:${sessionId}`;

    let paymentAttempt =
      await redis.get<PaymentAttempt>(
        paymentAttemptKey
      );

    if (!paymentAttempt) {
      const bookingSession =
        await redis.get<BookingSession>(
          `booking-session:${sessionId}`
        );

      if (!bookingSession) {
        console.error(
          "Valid payment webhook could not be matched to durable booking data.",
          {
            sessionId,
            transactionId,
          }
        );

        return NextResponse.json({
          received: true,
        });
      }

      const now =
        Date.now();

      paymentAttempt = {
        sessionId,
        claimId:
          "legacy-webhook-recovery",
        session:
          bookingSession,
        status:
          "ready",
        createdAt:
          bookingSession.createdAt,
        updatedAt:
          now,
      };

      await redis.set(
        paymentAttemptKey,
        paymentAttempt,
        {
          ex:
            PAYMENT_STATE_TTL_SECONDS,
        }
      );
    }

    if (
      paymentAttempt.session.sessionId !==
      sessionId
    ) {
      console.error(
        "Payment-attempt session mismatch.",
        {
          sessionId,
          transactionId,
        }
      );

      return NextResponse.json(
        {
          error:
            "Payment session mismatch.",
        },
        { status: 409 }
      );
    }

    const authorizeEventKey =
      `authorize-event:${sessionId}`;

    const authorizeEvent:
      AuthorizeEvent = {
      eventType,
      transactionId,
      sessionId,
      receivedAt:
        Date.now(),
    };

    /*
     * First successful transaction wins.
     * A later webhook may be a harmless replay of the
     * same transaction; acknowledge it idempotently.
     * A DIFFERENT transaction must never overwrite the
     * original binding.
     */
    const eventClaim =
      await redis.set(
        authorizeEventKey,
        authorizeEvent,
        {
          nx: true,
          ex:
            PAYMENT_STATE_TTL_SECONDS,
        }
      );

    if (eventClaim !== "OK") {
      const existingEvent =
        await redis.get<AuthorizeEvent>(
          authorizeEventKey
        );

      if (
        existingEvent?.transactionId ===
        transactionId
      ) {
        /*
         * Harmless webhook redelivery. Continue
         * idempotently so any durable payment state
         * missed by an earlier partial failure is
         * repaired below.
         */
      } else if (
        existingEvent?.transactionId
      ) {
        const incident:
          DuplicatePaymentIncident = {
          sessionId,
          originalTransactionId:
            existingEvent.transactionId,
          duplicateTransactionId:
            transactionId,
          detectedAt:
            Date.now(),
          booking:
            paymentAttempt.session,
        };

        await redis.set(
          `duplicate-payment:${sessionId}:${transactionId}`,
          incident,
          {
            ex:
              PAYMENT_STATE_TTL_SECONDS,
          }
        );

        await sendDuplicatePaymentAlert(
          incident
        );

        console.error(
          "Additional Authorize.Net transaction detected for booking session.",
          {
            sessionId,
            originalTransactionId:
              existingEvent.transactionId,
            duplicateTransactionId:
              transactionId,
          }
        );

        return NextResponse.json({
          received: true,
          duplicatePayment:
            true,
        });
      } else {
        return NextResponse.json(
          {
            error:
              "Could not safely bind the payment transaction.",
          },
          { status: 409 }
        );
      }
    }

    const paidAt =
      Date.now();

    const paidAttempt:
      PaymentAttempt = {
      ...paymentAttempt,
      status:
        "paid",
      transactionId,
      paidAt,
      updatedAt:
        paidAt,
    };

    await redis.set(
      paymentAttemptKey,
      paidAttempt,
      {
        ex:
          PAYMENT_STATE_TTL_SECONDS,
      }
    );

    /*
     * Preserve a durable recovery-visible record as soon
     * as money has moved. Normal successful Bookeo
     * finalization deletes orphan-payment:${sessionId}.
     * If the browser never returns, this record remains
     * visible to the protected recovery administration.
     */
    const booking =
      paymentAttempt.session;

    const paidPending:
      OrphanPayment = {
      sessionId,
      transactionId,
      amount:
        booking.total,
      holdId:
        booking.holdId,
      productId:
        booking.productId,
      eventId:
        booking.eventId,
      players:
        booking.players,
      location:
        booking.location,
      date:
        booking.date,
      time:
        booking.time,
      firstName:
        booking.firstName,
      lastName:
        booking.lastName,
      email:
        booking.email,
      phone:
        booking.phone,
      bookeoError: {
        stage:
          "payment_received_pending_finalization",
      },
      createdAt:
        paidAt,
      status:
        "needs_recovery",
      failureType:
        "payment_received_pending_finalization",
    };

    await redis.set(
      `orphan-payment:${sessionId}`,
      paidPending,
      {
        nx: true,
        ex:
          PAYMENT_STATE_TTL_SECONDS,
      }
    );

    /*
     * Complete the paid booking server-side after the
     * webhook response is ready. The customer's browser
     * is no longer required to return from Authorize.Net
     * in order for Bookeo finalization to occur.
     */
    after(async () => {
      try {
        const result =
          await completePaidBooking(
            sessionId
          );

        if (!result.ok) {
          console.error(
            "Automatic paid-booking completion did not finish successfully.",
            {
              sessionId,
              status:
                result.status,
              pending:
                result.pending || false,
              recoveryRequired:
                result.recoveryRequired ||
                false,
            }
          );
        }
      } catch (error) {
        console.error(
          "Automatic paid-booking completion failed unexpectedly.",
          {
            sessionId,
            error:
              error instanceof Error
                ? error.name
                : "unknown",
          }
        );
      }
    });

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "AUTHORIZE.NET WEBHOOK ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}