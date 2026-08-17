import { NextResponse } from "next/server";

const BOOKEO_KOP_API_KEY = process.env.BOOKEO_KOP_API_KEY;
const BOOKEO_CH_API_KEY = process.env.BOOKEO_CH_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

function getEasternOffset(dateString: string) {
  const testDate = new Date(`${dateString}T12:00:00Z`);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    timeZoneName: "longOffset",
  }).formatToParts(testDate);

  const offset =
    parts.find((part) => part.type === "timeZoneName")?.value || "GMT-04:00";

  return offset.replace("GMT", "");
}

export async function GET(request: Request) {

  const { searchParams } = new URL(request.url);
  const location = searchParams.get("location");

  const BOOKEO_API_KEY =
    location === "cherry-hill"
      ? BOOKEO_CH_API_KEY
      : location === "king-of-prussia"
        ? BOOKEO_KOP_API_KEY
        : null;

  if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
    return NextResponse.json(
      { error: "Missing or invalid Bookeo location/credentials" },
      { status: 500 }
    );
  }

  const productId =
    searchParams.get("productId") || "4156839XMX719DC101DCB0";

  const date = searchParams.get("date") || "2026-04-27";

  const easternOffset = getEasternOffset(date);

  const startTime = `${date}T00:00:00${easternOffset}`;
  const endTime = `${date}T23:59:59${easternOffset}`;

  const url =
    `https://api.bookeo.com/v2/availability/slots` +
    `?productId=${productId}` +
    `&startTime=${encodeURIComponent(startTime)}` +
    `&endTime=${encodeURIComponent(endTime)}`;

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    headers: {
      "X-Bookeo-apiKey": BOOKEO_API_KEY,
      "X-Bookeo-secretKey": BOOKEO_SECRET_KEY,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("========== BOOKEO ERROR ==========");
    console.error("LOCATION:", location);
    console.error("PRODUCT ID:", productId);
    console.error("STATUS:", response.status);
    console.error("STATUS TEXT:", response.statusText);
    console.error("RETRY-AFTER:", response.headers.get("retry-after"));
    console.error("BOOKEO BODY:", data);
    console.error("==================================");
  }

  return NextResponse.json(data, {
    status: response.status,
    headers: response.headers.get("retry-after")
      ? { "Retry-After": response.headers.get("retry-after")! }
      : undefined,
  });
}