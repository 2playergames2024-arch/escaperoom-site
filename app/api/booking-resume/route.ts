import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  type BookingSession,
  type FinalizedBooking,
  isValidBookingSessionId,
} from "../../lib/booking";
import {
  getBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";

const redis = Redis.fromEnv();

function inactiveResponse() {
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
    return inactiveResponse();
  }

  /*
   * booking-v2 uses Postgres as the durable
   * source of truth for payment/booking state.
   *
   * Only HOLD_CREATED is safe to present as
   * "Booking in Progress" / "Continue Booking".
   *
   * AUTHORIZING, AUTHORIZED, BOOKED,
   * CAPTURE_FAILED, COMPLETE, FAILED, and
   * VOIDED must never invite another payment.
   */
  const ledgerRecord =
    session.checkoutId
      ? await getBookingLedgerRecord(
          session.checkoutId
        )
      : null;

  if (
    ledgerRecord &&
    ledgerRecord.status !==
      BOOKING_STATES.HOLD_CREATED
  ) {
    return inactiveResponse();
  }

  /*
   * Keep the legacy finalized marker check
   * during the booking-v2 transition.
   */
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
    return inactiveResponse();
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
