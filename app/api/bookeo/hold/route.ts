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
    }),
  });

  const data = await response.json();

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
}