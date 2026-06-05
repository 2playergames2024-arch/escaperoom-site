import { NextResponse } from "next/server";

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

export async function GET(request: Request) {
  if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing Bookeo API credentials" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);

  const productId =
    searchParams.get("productId") || "4156839XMX719DC101DCB0";

  const date = searchParams.get("date") || "2026-04-27";

  const startTime = `${date}T00:00:00-04:00`;
  const endTime = `${date}T23:59:59-04:00`;

  const url =
    `https://api.bookeo.com/v2/availability/slots` +
    `?apiKey=${BOOKEO_API_KEY}` +
    `&secretKey=${BOOKEO_SECRET_KEY}` +
    `&productId=${productId}` +
    `&startTime=${encodeURIComponent(startTime)}` +
    `&endTime=${encodeURIComponent(endTime)}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  const data = await response.json();

  return NextResponse.json(data, { status: response.status });
}