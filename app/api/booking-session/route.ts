import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  type BookingSession,
  type TrustedBookeoHold,
  isValidBookingSessionId,
} from "../../lib/booking";

const redis = Redis.fromEnv();

function normalizeText(
  value: unknown,
  maxLength: number
) {
  return String(value || "")
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value: string) {
  return (
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function isValidPhone(value: string) {
  const digits =
    value.replace(/\D/g, "");

  return (
    digits.length >= 7 &&
    digits.length <= 15
  );
}

function getClientIp(request: Request) {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  return (
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get(
      "x-real-ip"
    ) ||
    "unknown"
  );
}

export async function POST(req: Request) {
  const ip =
    getClientIp(req);

  const rateLimitKey =
    `rate-limit:booking-session:${ip}`;

  const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      180
    );

  if (attempts > 15) {
    return NextResponse.json(
      {
        error:
          "Too many booking attempts. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "180",
        },
      }
    );
  }

  try {
    const body =
      await req.json();

    const holdId =
      normalizeText(
        body.holdId,
        200
      );

    const firstName =
      normalizeText(
        body.firstName,
        100
      );

    const lastName =
      normalizeText(
        body.lastName,
        100
      );

    const email =
      normalizeText(
        body.email,
        254
      );

    const phone =
      normalizeText(
        body.phone,
        40
      );

    if (!holdId) {
      return NextResponse.json(
        {
          error:
            "Missing booking hold.",
        },
        { status: 400 }
      );
    }

    if (
      !firstName ||
      !lastName
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter your first and last name.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidEmail(email)
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidPhone(phone)
    ) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid phone number.",
        },
        { status: 400 }
      );
    }

    const trustedHold =
      await redis.get<TrustedBookeoHold>(
        `bookeo-hold:${holdId}`
      );

    if (!trustedHold) {
      return NextResponse.json(
        {
          error:
            "Booking hold could not be verified. Please select your room and time again.",
        },
        { status: 400 }
      );
    }

    const existingSessionId =
      await redis.get<string>(
        `booking-session-for-hold:${holdId}`
      );

    if (
      existingSessionId
    ) {
      const existingSession =
        await redis.get<BookingSession>(
          `booking-session:${existingSessionId}`
        );

      if (existingSession) {
        const response =
          NextResponse.json({
            sessionId:
              existingSessionId,
          });

        response.cookies.set(
          "erm_booking_resume",
          existingSessionId,
          {
            httpOnly: true,
            secure:
              process.env.NODE_ENV ===
              "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60,
          }
        );

        return response;
      }

      await redis.del(
        `booking-session-for-hold:${holdId}`
      );
    }

    const sessionId =
      `ERM-${crypto.randomUUID()}`;

    const session: BookingSession = {
      sessionId,

      holdId:
        trustedHold.holdId,

      productId:
        trustedHold.productId,

      eventId:
        trustedHold.eventId,

      players:
        trustedHold.players,

      location:
        trustedHold.location,

      roomSlug:
        trustedHold.roomSlug,

      roomName:
        trustedHold.roomName,

      image:
        trustedHold.image,

      date:
        trustedHold.date,

      time:
        trustedHold.time,

      roomCharge:
        trustedHold.roomCharge,

      promotionDiscount:
        trustedHold.promotionDiscount,

      tax:
        trustedHold.tax,

      total:
        trustedHold.total,

      holdExpiration:
        trustedHold.holdExpiration,

      firstName,
      lastName,
      email,
      phone,

      createdAt:
        Date.now(),
    };

    /*
     * Create the session record BEFORE publishing the hold -> session
     * mapping. This removes the race where another request could observe
     * a mapping whose session did not exist yet.
     *
     * A provisional session that loses the mapping race is deleted below.
     */
    await redis.set(
      `booking-session:${sessionId}`,
      session,
      {
        ex: 60 * 60,
      }
    );

    const mappingResult =
      await redis.set(
        `booking-session-for-hold:${holdId}`,
        sessionId,
        {
          nx: true,
          ex: 60 * 60,
        }
      );

    if (
      mappingResult !== "OK"
    ) {
      /*
       * Another request already owns this hold. Our provisional session
       * must not remain reachable as a second valid session.
       */
      await redis.del(
        `booking-session:${sessionId}`
      );

      const claimedSessionId =
        await redis.get<string>(
          `booking-session-for-hold:${holdId}`
        );

      if (
        claimedSessionId
      ) {
        const claimedSession =
          await redis.get<BookingSession>(
            `booking-session:${claimedSessionId}`
          );

        if (claimedSession) {
          const response =
            NextResponse.json({
              sessionId:
                claimedSessionId,
            });

          response.cookies.set(
            "erm_booking_resume",
            claimedSessionId,
            {
              httpOnly: true,
              secure:
                process.env.NODE_ENV ===
                "production",
              sameSite: "lax",
              path: "/",
              maxAge: 60 * 60,
            }
          );

          return response;
        }

        /*
         * With the session-first write order, a mapping without its
         * session should only be stale/corrupt state. Fail closed rather
         * than deleting another request's ownership claim.
         */
        return NextResponse.json(
          {
            error:
              "Booking session creation is still being resolved. Please try again.",
            retryable: true,
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            "Could not securely create the booking session. Please try again.",
          retryable: true,
        },
        { status: 409 }
      );
    }

    const response =
      NextResponse.json({
        sessionId,
      });

    response.cookies.set(
      "erm_booking_resume",
      sessionId,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60,
      }
    );

    return response;
  } catch (error) {
    console.error(
      "Booking session creation failed.",
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
          "Could not create booking session.",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const ip =
      getClientIp(req);

    /*
     * Payment-page reads are legitimate and may happen
     * several times during reloads or recovery.
     *
     * Keep this comfortably above normal customer use
     * while preventing unlimited session probing.
     */
    const rateLimitKey =
      `rate-limit:booking-session-get:${ip}`;

    const attempts =
      await incrementRateLimit(
        redis,
        rateLimitKey,
        600
      );

    if (attempts > 60) {
      return NextResponse.json(
        {
          error:
            "Too many booking-session requests. Please wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After":
              "600",
          },
        }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const sessionId =
      String(
        searchParams.get(
          "sessionId"
        ) || ""
      ).trim();

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    /*
     * Reject obviously malformed values before
     * querying Redis.
     */
    if (
      !isValidBookingSessionId(
        sessionId
      )
    ) {
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
            "Booking session not found.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: {
        sessionId:
          session.sessionId,

        location:
          session.location,

        roomName:
          session.roomName,

        image:
          session.image,

        date:
          session.date,

        time:
          session.time,

        players:
          session.players,

        roomCharge:
          session.roomCharge,

        promotionDiscount:
          session.promotionDiscount,

        tax:
          session.tax,

        total:
          session.total,

        customerName:
          `${session.firstName} ${session.lastName}`.trim(),
      },
    });
  } catch (error) {
    console.error(
      "Booking session retrieval failed.",
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
          "Could not retrieve booking session.",
      },
      { status: 500 }
    );
  }
}