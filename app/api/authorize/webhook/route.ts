import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  createHmac,
  createHash,
  timingSafeEqual,
} from "crypto";

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
     * IMPORTANT:
     * Read the webhook body as raw bytes.
     * We calculate the HMAC against these exact bytes.
     */
    const rawBodyBuffer = Buffer.from(
      await req.arrayBuffer()
    );

    /*
     * We still need the string later so that we can
     * parse the verified JSON.
     */
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

    const keyHex = signatureKey.trim();

    /*
     * Interpretation A:
     * Official documented method.
     *
     * Convert the 128-character hexadecimal
     * Signature Key into its 64-byte binary form.
     */
    const keyBytesA = Buffer.from(
      keyHex,
      "hex"
    );

    const calcA = createHmac(
      "sha512",
      keyBytesA
    )
      .update(rawBodyBuffer)
      .digest("hex")
      .toLowerCase();

    /*
     * Interpretation B:
     * DIAGNOSTIC ONLY.
     *
     * Some community implementations use the
     * 128-character key as a literal string.
     *
     * We calculate it only so we can see whether
     * Authorize.net happens to match it.
     *
     * It is NOT used to authorize the webhook.
     */
    const calcB = createHmac(
      "sha512",
      keyHex
    )
      .update(rawBodyBuffer)
      .digest("hex")
      .toLowerCase();

    /*
     * Safe diagnostic fingerprints.
     *
     * These let us determine whether the body
     * or key changes between requests without
     * logging the actual Signature Key.
     */
    const bodySha16 = createHash("sha256")
      .update(rawBodyBuffer)
      .digest("hex")
      .slice(0, 16);

    const keyASha16 = createHash("sha256")
      .update(keyBytesA)
      .digest("hex")
      .slice(0, 16);

    console.log("WEBHOOK DIAGNOSTIC", {
      bodyLen: rawBodyBuffer.length,
      bodySha16,

      keyHexLength: keyHex.length,
      keyIsHex:
        /^[0-9a-fA-F]+$/.test(keyHex),
      keyAByteLen: keyBytesA.length,
      keyASha16,

      receivedFirst16:
        normalizedSignature.slice(0, 16),
      receivedLast16:
        normalizedSignature.slice(-16),

      calcAFirst16:
        calcA.slice(0, 16),
      calcALast16:
        calcA.slice(-16),

      calcBFirst16:
        calcB.slice(0, 16),
      calcBLast16:
        calcB.slice(-16),

      matchA:
        normalizedSignature === calcA,

      matchB:
        normalizedSignature === calcB,

      nodeVersion:
        process.versions?.node || null,
    });

    /*
     * SECURITY CHECK:
     *
     * We continue to trust ONLY Interpretation A,
     * the documented hex-to-binary Signature Key
     * method.
     */
    const receivedBuffer = Buffer.from(
      normalizedSignature,
      "hex"
    );

    const calculatedBuffer = Buffer.from(
      calcA,
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
        {
          error:
            "Invalid webhook signature.",
        },
        { status: 401 }
      );
    }

    /*
     * Signature is valid.
     * Only now do we parse and trust the webhook.
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
     * We only expect the payment event selected
     * in Authorize.net.
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
     * A test webhook or unrelated transaction may
     * not contain one of our ERM booking session IDs.
     *
     * Acknowledge it, but do not store it.
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
     * Never allow a webhook to create a relationship
     * with a booking session that does not exist.
     */
    const bookingSession = await redis.get(
      `booking-session:${sessionId}`
    );

    if (!bookingSession) {
      return NextResponse.json({
        received: true,
      });
    }

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
        error:
          "Webhook processing failed.",
      },
      { status: 500 }
    );
  }
}