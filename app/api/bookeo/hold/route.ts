import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

export async function POST(request: Request) {
  if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing Bookeo API credentials" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const url =
      `https://api.bookeo.com/v2/holds` +
      `?apiKey=${BOOKEO_API_KEY}` +
      `&secretKey=${BOOKEO_SECRET_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: body.eventId,
        productId: body.productId,

        participants: {
          numbers: [
            {
              peopleCategoryId: "Cadults",
              number: body.players,
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
        players: String(body.players),
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