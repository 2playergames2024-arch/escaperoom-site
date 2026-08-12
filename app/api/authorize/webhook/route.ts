import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createHmac, timingSafeEqual } from "crypto";

const redis = Redis.fromEnv();

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
      !sessionId ||
      !sessionId.startsWith("ERM-")
    ) {
      return NextResponse.json({
        received: true,
      });
    }

    /*
     * Only associate an Authorize.net transaction
     * with a booking session that actually exists.
     */
    const bookingSession = await redis.get(
      `booking-session:${sessionId}`
    );

    if (!bookingSession) {
      return NextResponse.json({
        received: true,
      });
    }

    /*
     * Store the verified Authorize.net event.
     * The confirmation flow can now independently
     * verify the transaction and finalize Bookeo.
     */
    await redis.set(
      `authorize-event:${sessionId}`,
      {
        eventType,
        transactionId,
        sessionId,
        receivedAt: Date.now(),
      },
      {
        ex: 60 * 60 * 24,
      }
    );

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