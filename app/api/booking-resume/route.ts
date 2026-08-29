import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  type BookingSession,
  type FinalizedBooking,
  isValidBookingSessionId,
} from "../../lib/booking";

const redis = Redis.fromEnv();

export async function GET(
  request: Request
) {
  const sessionId =
    request.headers
      .get("cookie")
      ?.match(
        /(?:^|;\s*)erm_booking_resume=([^;]+)/
      )?.[1] || "";

  if (
    !isValidBookingSessionId(
      sessionId
    )
  ) {
    return NextResponse.json({
      active: false,
    });
  }

  const session =
    await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

  if (!session) {
    const response =
      NextResponse.json({
        active: false,
      });

    response.cookies.set(
      "erm_booking_resume",
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  }

  const finalizedBooking =
    await redis.get<FinalizedBooking>(
      `bookeo-finalized:${sessionId}`
    );

  const expirationTime =
    new Date(
      session.holdExpiration
    ).getTime();

  if (
    finalizedBooking ||
    !Number.isFinite(
      expirationTime
    ) ||
    Date.now() >=
      expirationTime
  ) {
    const response =
      NextResponse.json({
        active: false,
      });

    response.cookies.set(
      "erm_booking_resume",
      "",
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      }
    );

    return response;
  }

  return NextResponse.json({
    active: true,

    booking: {
      sessionId:
        session.sessionId,

      location:
        session.location,

      roomName:
        session.roomName,

      date:
        session.date,

      time:
        session.time,
    },
  });
}