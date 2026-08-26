import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

import {
  BOOKING_TEST_COOKIE_NAME,
  getBookingTestCookieValue,
} from "../../lib/bookingTestAccess";

function safeEqual(
  provided: string,
  expected: string
) {
  const providedBuffer =
    Buffer.from(provided);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
}

export async function POST(
  request: Request
) {
  try {
    const secret =
      process.env
        .BOOKING_TEST_BYPASS_TOKEN;

    if (!secret) {
      return NextResponse.json(
        {
          error:
            "Staff booking access is not configured.",
        },
        { status: 500 }
      );
    }

    const body =
      await request.json();

    const code =
      String(
        body.code || ""
      ).trim();

    if (
      !code ||
      !safeEqual(
        code,
        secret.trim()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid access code.",
        },
        { status: 401 }
      );
    }

    const cookieValue =
      getBookingTestCookieValue();

    if (!cookieValue) {
      return NextResponse.json(
        {
          error:
            "Staff booking access is not configured.",
        },
        { status: 500 }
      );
    }

    const response =
      NextResponse.json({
        success: true,
      });

    response.cookies.set(
      BOOKING_TEST_COOKIE_NAME,
      cookieValue,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 2,
      }
    );

    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not enable staff booking access.",
      },
      { status: 500 }
    );
  }
}