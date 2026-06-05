import { NextResponse } from "next/server";

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

export async function POST(request: Request) {
  if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing Bookeo API credentials" },
      { status: 500 }
    );
  }

  const body = await request.json();

  if (!body.holdId) {
    return NextResponse.json(
      { error: "Missing holdId" },
      { status: 400 }
    );
  }

  const url =
    `https://api.bookeo.com/v2/bookings` +
    `?apiKey=${BOOKEO_API_KEY}` +
    `&secretKey=${BOOKEO_SECRET_KEY}` +
    `&previousHoldId=${encodeURIComponent(body.holdId)}`;

  const response = await fetch(url, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productId: body.productId,
      eventId: body.eventId,
      participants: {
        numbers: [
          {
            peopleCategoryId: "Cadults",
            number: Number(body.players),
          },
        ],
      },
      customer: {
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        emailAddress: body.email || "",
        phoneNumbers: body.phone
          ? [
              {
                number: body.phone,
                type: "mobile",
              },
            ]
          : [],
      },
      initialPayments: [
        {
          reason: "Paid online",
          comment: "Paid through Authorize.net hosted payment form",
          amount: {
            amount: Number(body.total).toFixed(2),
            currency: "USD",
          },
          paymentMethod: "creditCard",
        },
      ],
    }),
  });

  const data = await response.json();

    if (!response.ok) {
    console.log("BOOKEO FINALIZE ERROR:", JSON.stringify(data, null, 2));
    }

    return NextResponse.json(
    {
        status: response.status,
        data,
    },
    { status: response.status }
  );
}