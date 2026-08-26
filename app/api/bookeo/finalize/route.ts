import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import { isValidBookingSessionId } from "../../../lib/booking";
import { finalizeBookeoBookingForSession } from "../../../lib/paymentCompletion";

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  try {
    const forwardedFor =
      request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey =
      `rate-limit:bookeo-finalize:${ip}`;

    const attempts =
      await incrementRateLimit(
        redis,
        rateLimitKey,
        600
      );

    if (attempts > 20) {
      return NextResponse.json(
        {
          error:
            "Too many booking finalization attempts. Please wait a few minutes and try again.",
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
          error:
            "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    const result =
      await finalizeBookeoBookingForSession(
        sessionId
      );

    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.error,

          recoveryRequired:
            result.recoveryRequired ||
            false,

          retryable:
            result.retryable,
        },
        {
          status:
            result.status,
        }
      );
    }

    return NextResponse.json({
      status: 200,

      data: {
        id:
          result.bookingId,
      },

      alreadyFinalized:
        result.alreadyFinalized ||
        false,

      purchase:
        result.purchase,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not safely confirm the booking. Recovery may be required.",

        recoveryRequired:
          true,

        retryable:
          false,
      },
      { status: 500 }
    );
  }
}