import "server-only";

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  isValidBookingSessionId,
  type BookingSession,
} from "@/app/lib/booking";
import {
  rememberBookingNotificationSource,
  triggerCompletedBookingNotifications,
} from "@/app/lib/bookingNotifications";

const redis = Redis.fromEnv();

export async function POST(request: Request) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.NOTIFICATION_TEST_MODE !== "true"
  ) {
    return NextResponse.json(
      {
        error:
          "Notification test mode is not available.",
      },
      { status: 404 }
    );
  }

  if (
    process.env.SMS_NOTIFICATIONS_ENABLED !== "true"
  ) {
    return NextResponse.json(
      {
        error:
          "SMS notifications are disabled for this Preview.",
      },
      { status: 503 }
    );
  }

  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    return NextResponse.json(
      {
        error:
          "Twilio is not fully configured for this Preview.",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const sessionId = String(
      body?.sessionId || ""
    ).trim();

    if (!isValidBookingSessionId(sessionId)) {
      return NextResponse.json(
        {
          error:
            "Invalid booking session ID.",
        },
        { status: 400 }
      );
    }

    const session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Booking session was not found or has expired.",
        },
        { status: 404 }
      );
    }

    /*
     * Every test gets a unique synthetic checkout ID so
     * the real duplicate-send protection stays active while
     * repeated Preview tests still work.
     */
    const testCheckoutId =
      `${session.checkoutId}:notification-test:${crypto.randomUUID()}`;

    const testSession: BookingSession = {
      ...session,
      checkoutId: testCheckoutId,
    };

    await rememberBookingNotificationSource(
      testSession
    );

    await triggerCompletedBookingNotifications({
      checkoutId: testCheckoutId,
      holdId: null,
    });

    return NextResponse.json({
      ok: true,
      test: true,
    });
  } catch (error) {
    console.error(
      "Notification Preview test failed.",
      {
        reason:
          error instanceof Error
            ? error.message
            : "unknown",
      }
    );

    return NextResponse.json(
      {
        error:
          "Notification test could not be completed.",
      },
      { status: 500 }
    );
  }
}
