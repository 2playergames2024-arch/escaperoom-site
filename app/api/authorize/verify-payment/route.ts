import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import { isValidBookingSessionId } from "../../../lib/booking";
import { verifyAuthorizePaymentForSession } from "../../../lib/paymentCompletion";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  try {
    const forwardedFor =
      req.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey =
      `rate-limit:verify-payment:${ip}`;

    const attempts =
      await incrementRateLimit(
        redis,
        rateLimitKey,
        600
      );

    if (attempts > 60) {
      return NextResponse.json(
        {
          verified: false,
          error:
            "Too many payment verification requests. Please wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

    const body =
      await req.json();

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
          verified: false,
          error:
            "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    const result =
      await verifyAuthorizePaymentForSession(
        sessionId
      );

    if (!result.ok) {
      return NextResponse.json(
        {
          verified: false,
          pending:
            result.pending || false,
          error:
            result.error,
        },
        {
          status:
            result.pending
              ? 202
              : 400,
        }
      );
    }

    return NextResponse.json({
      verified: true,
      transactionId:
        result.verifiedPayment.transactionId,
    });
  } catch {
    return NextResponse.json(
      {
        verified: false,
        error:
          "Payment verification failed.",
      },
      { status: 500 }
    );
  }
}