import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY = process.env.BOOKEO_KOP_API_KEY;
const BOOKEO_CH_API_KEY = process.env.BOOKEO_CH_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

export async function POST(request: Request) {

  const forwardedFor = request.headers.get("x-forwarded-for");

  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitKey = `rate-limit:bookeo-hold:${ip}`;

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
    const body = await request.json();
    // IMPORTANT:
    // Player limits are currently 2–10 for all rooms.
    // If any room's limits change in the future, update ALL of these:
    // 1. Bookeo product min/max settings
    // 2. Customer-facing player selector
    // 3. This server-side validation
    // Then test the new minimum, maximum, one below minimum, and one above maximum.
    const players = Number(body.players);

    if (!Number.isInteger(players) || players < 2 || players > 10) {
      return NextResponse.json(
        {
          error: "Player count must be between 2 and 10.",
        },
        { status: 400 }
      );
    }
    const BOOKEO_API_KEY =
      body.location === "cherry-hill"
        ? BOOKEO_CH_API_KEY
        : body.location === "king-of-prussia"
          ? BOOKEO_KOP_API_KEY
          : null;

    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing or invalid Bookeo location/credentials" },
        { status: 500 }
      );
    }

    const url =
      `https://api.bookeo.com/v2/holds`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Bookeo-apiKey": BOOKEO_API_KEY,
        "X-Bookeo-secretKey": BOOKEO_SECRET_KEY,
      },
      body: JSON.stringify({
        eventId: body.eventId,
        productId: body.productId,

        participants: {
          numbers: [
            {
              peopleCategoryId: "Cadults",
              number: players,
            },
          ],
        },

        promotionCodeInput: body.promoCode,
      }),
    });

    const data = await response.json();

    console.log("BOOKEO RESPONSE:");
    console.dir(data, { depth: null });

    if (!response.ok) {
      const message =
        JSON.stringify(data).toLowerCase().includes("voucher") ||
          JSON.stringify(data).toLowerCase().includes("promotion") ||
          JSON.stringify(data).toLowerCase().includes("coupon")
          ? "Gift voucher or promo code not found."
          : data.message ||
          data.error ||
          "Could not create booking hold.";

      return NextResponse.json(
        { message },
        { status: response.status }
      );
    }

    const holdId = data.id;
    const trustedTotal = Number(data.totalPayable?.amount);

    if (
      !holdId ||
      !Number.isFinite(trustedTotal) ||
      trustedTotal <= 0
    ) {
      console.error(
        "BOOKEO HOLD MISSING VALID PRICE:",
        data
      );

      return NextResponse.json(
        { error: "Bookeo returned an invalid booking price." },
        { status: 500 }
      );
    }

    /*
     * Save Bookeo's authoritative booking information.
     *
     * Date and time are retained for later reconciliation
     * if payment succeeds but booking finalization becomes
     * uncertain.
     */
    await redis.set(
      `bookeo-hold:${holdId}`,
      {
        holdId,
        productId: body.productId,
        eventId: body.eventId,
        players: String(players),
        location: body.location,
        date: String(body.date || ""),
        time: String(body.time || ""),
        total: trustedTotal.toFixed(2),
        createdAt: Date.now(),
      },
      {
        ex: 60 * 60,
      }
    );

    const headers: Record<string, string> = {};

    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return NextResponse.json(
      {
        status: response.status,
        headers,
        data,
      },
      { status: response.status }
    );
  } catch (error) {
    console.error("BOOKEO HOLD ERROR:", error);

    return NextResponse.json(
      {
        error: "Could not create booking hold.",
      },
      { status: 500 }
    );
  }
}