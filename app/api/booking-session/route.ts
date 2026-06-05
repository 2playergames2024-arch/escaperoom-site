import { NextResponse } from "next/server";

type BookingSession = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  total: string;
  createdAt: number;
};

const bookingSessions = new Map<string, BookingSession>();

export async function POST(req: Request) {
  const body = await req.json();

  const sessionId = "ERM-" + Date.now();

  bookingSessions.set(sessionId, {
    holdId: body.holdId,
    productId: body.productId,
    eventId: body.eventId,
    players: body.players,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    phone: body.phone,
    total: body.total,
    createdAt: Date.now(),
  });

  return NextResponse.json({ sessionId });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId") || "";

  const session = bookingSessions.get(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Booking session not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({ session });
}