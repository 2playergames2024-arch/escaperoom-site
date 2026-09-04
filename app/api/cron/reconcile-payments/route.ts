import {
  NextRequest,
  NextResponse,
} from "next/server";

import { Redis } from "@upstash/redis";

import {
  type PaymentAttempt,
} from "../../../lib/booking";

import {
  completePaidBooking,
} from "../../../lib/paymentCompletion";

const redis = Redis.fromEnv();

const RECOVERY_DELAY_MS =
  60 * 1000;

const MAX_AUTO_RECOVERY_AGE_MS =
  6 * 60 * 60 * 1000;

export async function GET(
  req: NextRequest
) {
  const authHeader =
    req.headers.get(
      "authorization"
    );

  const cronSecret =
    process.env.CRON_SECRET;

  if (
    !cronSecret ||
    authHeader !==
    `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  let cursor = 0;

  let checked = 0;
  let attempted = 0;
  let recovered = 0;

  do {
    const [
      nextCursor,
      keys,
    ] =
      await redis.scan(
        cursor,
        {
          match:
            "payment-attempt:*",
          count: 100,
        }
      );

    cursor =
      Number(nextCursor);

    for (const key of keys) {
      const paymentAttempt =
        await redis.get<PaymentAttempt>(
          key
        );

      if (
        !paymentAttempt ||
        paymentAttempt.status !==
        "ready"
      ) {
        continue;
      }

      checked++;

      const paymentAgeMs =
        Date.now() -
        paymentAttempt.updatedAt;

      if (
        paymentAgeMs <
        RECOVERY_DELAY_MS ||
        paymentAgeMs >
        MAX_AUTO_RECOVERY_AGE_MS
      ) {
        continue;
      }

      attempted++;

      const result =
        await completePaidBooking(
          paymentAttempt.sessionId
        );

      if (result.ok) {
        recovered++;
      }
    }
  } while (cursor !== 0);

  return NextResponse.json({
    ok: true,
    checked,
    attempted,
    recovered,
  });
}