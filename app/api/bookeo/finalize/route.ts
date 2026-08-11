import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

type BookingSession = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  total: string;
  createdAt: number;
};

type VerifiedPayment = {
  sessionId: string;
  transactionId: string;
  amount: string;
  transactionStatus: string;
  verifiedAt: number;
};

export async function POST(request: Request) {
  try {
    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        { error: "Missing Bookeo API credentials" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    /*
     * IMPORTANT:
     * Do not trust booking details sent by the browser.
     * Retrieve the real booking session from Redis.
     */
    const session = await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

    if (!session) {
      return NextResponse.json(
        { error: "Booking session not found." },
        { status: 404 }
      );
    }

    /*
     * HARD PAYMENT SECURITY GATE:
     * Bookeo cannot be finalized unless Authorize.net payment
     * has already been independently verified by our server.
     */
    const verifiedPayment = await redis.get<VerifiedPayment>(
      `verified-payment:${sessionId}`
    );

    if (!verifiedPayment) {
      return NextResponse.json(
        {
          error:
            "Payment has not been independently verified.",
        },
        { status: 403 }
      );
    }

    /*
     * Make sure the verified payment belongs to this exact session
     * and matches Bookeo's trusted amount.
     */
    const expectedAmount = Number(session.total);
    const verifiedAmount = Number(verifiedPayment.amount);

    if (
      verifiedPayment.sessionId !== sessionId ||
      !Number.isFinite(expectedAmount) ||
      !Number.isFinite(verifiedAmount) ||
      Math.abs(expectedAmount - verifiedAmount) >= 0.001
    ) {
      return NextResponse.json(
        {
          error:
            "Verified payment does not match this booking.",
        },
        { status: 403 }
      );
    }

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?apiKey=${BOOKEO_API_KEY}` +
      `&secretKey=${BOOKEO_SECRET_KEY}` +
      `&previousHoldId=${encodeURIComponent(session.holdId)}`;

    const response = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: session.productId,
        eventId: session.eventId,

        participants: {
          numbers: [
            {
              peopleCategoryId: "Cadults",
              number: Number(session.players),
            },
          ],
        },

        customer: {
          firstName: session.firstName || "",
          lastName: session.lastName || "",
          emailAddress: session.email || "",
          phoneNumbers: session.phone
            ? [
                {
                  number: session.phone,
                  type: "mobile",
                },
              ]
            : [],
        },

        initialPayments: [
          {
            reason: "Paid online",
            comment:
              `Authorize.net transaction ${verifiedPayment.transactionId}`,
            amount: {
              amount: expectedAmount.toFixed(2),
              currency: "USD",
            },
            paymentMethod: "creditCard",
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.log(
        "BOOKEO FINALIZE ERROR:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          status: response.status,
          data,
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      status: response.status,
      data,
    });
  } catch (error) {
    console.error("BOOKEO FINALIZE CRASH:", error);

    return NextResponse.json(
      {
        error: "Could not finalize booking.",
      },
      { status: 500 }
    );
  }
}