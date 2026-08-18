import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type TrustedBookeoHold = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  date: string;
  time: string;
  total: string;
  createdAt: number;
};

type BookingSession = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  total: string;
  createdAt: number;
};

export async function POST(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");

  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitKey = `rate-limit:booking-session:${ip}`;

  const attempts = await redis.incr(rateLimitKey);

  if (attempts === 1) {
    await redis.expire(rateLimitKey, 600);
  }

  if (attempts > 5) {
    return NextResponse.json(
      {
        error:
          "Too many booking attempts. Please wait a few minutes and try again.",
      },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();

    if (!body.holdId) {
      return NextResponse.json(
        { error: "Missing booking hold." },
        { status: 400 }
      );
    }

    /*
     * Retrieve the trusted booking information that our server
     * saved directly from Bookeo when the hold was created.
     */
    const trustedHold = await redis.get<TrustedBookeoHold>(
      `bookeo-hold:${body.holdId}`
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

    /*
     * Make sure the browser is referring to the same booking
     * that Bookeo gave our server.
     */
    if (
      trustedHold.holdId !== body.holdId ||
      trustedHold.productId !== body.productId ||
      trustedHold.eventId !== body.eventId ||
      trustedHold.players !== String(body.players)
    ) {
      return NextResponse.json(
        {
          error:
            "Booking information could not be verified. Please select your room and time again.",
        },
        { status: 400 }
      );
    }

    const sessionId =
      "ERM-" +
      Date.now() +
      "-" +
      crypto.randomUUID().slice(0, 8);

    const session: BookingSession = {
      holdId: trustedHold.holdId,
      productId: trustedHold.productId,
      eventId: trustedHold.eventId,
      players: trustedHold.players,
      location: trustedHold.location,
      date: trustedHold.date,
      time: trustedHold.time,

      firstName: body.firstName || "",
      lastName: body.lastName || "",
      email: body.email || "",
      phone: body.phone || "",

      /*
       * IMPORTANT:
       * This total comes from Bookeo's server-side trusted
       * record, NOT from the customer's browser.
       */
      total: trustedHold.total,

      createdAt: Date.now(),
    };

    await redis.set(
      `booking-session:${sessionId}`,
      session,
      {
        ex: 60 * 60,
      }
    );

    return NextResponse.json({ sessionId });
  } catch (error) {
    console.error(
      "BOOKING SESSION POST ERROR:",
      error
    );

    return NextResponse.json(
      { error: "Could not create booking session." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId =
      searchParams.get("sessionId") || "";

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    const session = await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

    if (!session) {
      return NextResponse.json(
        { error: "Booking session not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error(
      "BOOKING SESSION GET ERROR:",
      error
    );

    return NextResponse.json(
      { error: "Could not retrieve booking session." },
      { status: 500 }
    );
  }
}