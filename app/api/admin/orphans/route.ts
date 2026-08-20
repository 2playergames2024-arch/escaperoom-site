import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";

const redis = Redis.fromEnv();

export async function GET(request: Request) {
  try {
    /*
     * Protect the administrative recovery endpoint
     * from unlimited secret-guessing attempts.
     */
    const forwardedFor =
      request.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey =
      `rate-limit:admin-orphans:${ip}`;

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
            "Too many recovery administration requests.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

    const adminSecret =
      process.env.ADMIN_RECOVERY_SECRET;

    if (!adminSecret) {
      console.error(
        "Recovery administration is not configured."
      );

      return NextResponse.json(
        {
          error:
            "Recovery administration is not configured.",
        },
        { status: 500 }
      );
    }

    const suppliedSecret =
      request.headers.get(
        "x-admin-secret"
      );

    if (
      suppliedSecret !== adminSecret
    ) {
      return NextResponse.json(
        {
          error:
            "Unauthorized.",
        },
        { status: 401 }
      );
    }

    const keys =
      await redis.keys(
        "orphan-payment:*"
      );

    if (
      !keys ||
      keys.length === 0
    ) {
      return NextResponse.json({
        count: 0,
        orphans: [],
      });
    }

    const orphans =
      await redis.mget(...keys);

    const result =
      keys.map(
        (key, index) => ({
          key,
          data:
            orphans[index],
        })
      );

    return NextResponse.json({
      count:
        result.length,
      orphans:
        result,
    });
  } catch (error) {
    console.error(
      "Recovery administration request failed.",
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
          "Could not list orphan payments.",
      },
      { status: 500 }
    );
  }
}