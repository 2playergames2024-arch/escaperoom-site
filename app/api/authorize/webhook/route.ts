import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { createHmac, timingSafeEqual } from "crypto";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    const signatureKey = process.env.AUTHORIZE_SIGNATURE_KEY;

    if (!signatureKey) {
      console.error("AUTHORIZE_SIGNATURE_KEY is missing.");

      return NextResponse.json(
        { error: "Webhook verification is not configured." },
        { status: 500 }
      );
    }

    /*
     * IMPORTANT:
     * Authorize.net signs the exact raw request body.
     * Verify it BEFORE parsing or trusting the webhook.
     */
    const rawBody = await req.text();

    const receivedSignature =
      req.headers.get("x-anet-signature") || "";

    if (!receivedSignature) {
      return NextResponse.json(
        { error: "Missing webhook signature." },
        { status: 401 }
      );
    }

    const normalizedSignature = receivedSignature
      .replace(/^sha512=/i, "")
      .trim()
      .toLowerCase();

    let signatureKeyBytes: Buffer;

    try {
      signatureKeyBytes = Buffer.from(signatureKey.trim(), "hex");
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook configuration." },
        { status: 500 }
      );
    }

    const calculatedSignature = createHmac(
      "sha512",
      signatureKeyBytes
    )
      .update(rawBody, "utf8")
      .digest("hex")
      .toLowerCase();
    console.log("WEBHOOK SIGNATURE DIAGNOSTICS", {
      signatureHeaderPresent: Boolean(receivedSignature),
      signatureHeaderPrefix: receivedSignature.slice(0, 7),
      receivedSignatureLength: normalizedSignature.length,
      calculatedSignatureLength: calculatedSignature.length,
      rawBodyLength: rawBody.length,
      signatureKeyLength: signatureKey.trim().length,
      signatureKeyIsHex: /^[0-9a-fA-F]+$/.test(signatureKey.trim()),
      signatureKeyByteLength: signatureKeyBytes.length,
    });

    const receivedBuffer = Buffer.from(
      normalizedSignature,
      "hex"
    );

    const calculatedBuffer = Buffer.from(
      calculatedSignature,
      "hex"
    );

    if (
      receivedBuffer.length !== calculatedBuffer.length ||
      !timingSafeEqual(receivedBuffer, calculatedBuffer)
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
     * Only now do we parse and trust the webhook body.
     */
    const body = JSON.parse(rawBody);

    const eventType = String(body?.eventType || "");
    const transactionId = String(body?.payload?.id || "");
    const sessionId = String(
      body?.payload?.merchantReferenceId || ""
    );

    /*
     * We only expect the payment event selected in Authorize.net.
     */
    if (
      eventType !==
      "net.authorize.payment.authcapture.created"
    ) {
      return NextResponse.json({ received: true });
    }

    /*
     * A test webhook or unrelated transaction may not contain
     * one of our ERM booking session IDs.
     *
     * Acknowledge it, but do not store it.
     */
    if (
      !transactionId ||
      !sessionId ||
      !sessionId.startsWith("ERM-")
    ) {
      return NextResponse.json({ received: true });
    }

    /*
     * Never allow a webhook to create a relationship with a
     * booking session that does not actually exist.
     */
    const bookingSession = await redis.get(
      `booking-session:${sessionId}`
    );

    if (!bookingSession) {
      return NextResponse.json({ received: true });
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

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("AUTHORIZE.NET WEBHOOK ERROR:", error);

    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}