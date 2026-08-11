import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log(
      "AUTHORIZE.NET WEBHOOK:",
      JSON.stringify(body, null, 2)
    );

    const eventType = body?.eventType;
    const transactionId = body?.payload?.id;
    const sessionId = body?.payload?.merchantReferenceId;

    if (!transactionId || !sessionId) {
      return NextResponse.json({ received: true });
    }

    await redis.set(
      `authorize-event:${sessionId}`,
      {
        eventType,
        transactionId: String(transactionId),
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