"use client";

import { LOCATIONS } from "../../data/locations";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function BookingDetailsPage() {
  const searchParams = useSearchParams();

  const room = searchParams.get("room") || "Selected Room";
  const image = searchParams.get("image") || "";
  const productId = searchParams.get("productId") || "";
  const eventId = searchParams.get("eventId") || "";
  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const seats = Number(searchParams.get("seats") || "10");
  const roomInfo =
    LOCATIONS.kingOfPrussia.rooms[
      room as keyof typeof LOCATIONS.kingOfPrussia.rooms
    ];

  const basePrice = roomInfo?.basePrice ?? 35.01;

  const [players, setPlayers] = useState(2);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  const total = players * basePrice;

  function handleContinue() {
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    console.log("Ready for Bookeo hold", {
      room,
      productId,
      eventId,
      date,
      time,
      players,
      fullName,
      email,
      phone,
      total,
    });

    async function createHold() {
        const res = await fetch("/api/bookeo/hold", {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify({
            productId,
            eventId,
            players,
            fullName,
            email,
            phone,
            }),
        });

        const data = await res.json();

        console.log("Bookeo hold result", data);

        if (!res.ok) {
            setError(data.message || data.error || "Could not create booking hold.");
            return;
        }

        const holdId = data.data.id;
        const bookeoTotal = data.data.totalPayable.amount;

        window.location.href =
        `/book/payment` +
        `?holdId=${encodeURIComponent(holdId)}` +
        `&productId=${encodeURIComponent(productId)}` +
        `&eventId=${encodeURIComponent(eventId)}` +
        `&room=${encodeURIComponent(room)}` +
        `&date=${encodeURIComponent(date)}` +
        `&time=${encodeURIComponent(time)}` +
        `&players=${players}` +
        `&total=${encodeURIComponent(bookeoTotal)}` +
        `&fullName=${encodeURIComponent(fullName)}` +
        `&email=${encodeURIComponent(email)}` +
        `&phone=${encodeURIComponent(phone)}`;
    }
    createHold();
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href="/locations/king-of-prussia/book-now"
          className="mb-8 inline-block text-sm font-black uppercase text-orange-500"
        >
          ← Back to times
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          <section>
            <h1 className="text-4xl font-black">Booking Details</h1>

            <div className="mt-8 overflow-hidden rounded-[18px] border-2 border-slate-950">
              {image && (
                <div className="relative h-64 bg-slate-900">
                  <Image
                    src={image}
                    alt={room}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 60vw"
                  />
                  <div className="absolute inset-0 bg-black/25" />
                </div>
              )}

              <div className="p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
                  Selected Room
                </p>

                <h2 className="mt-2 text-3xl font-black">{room}</h2>

                <div className="mt-6 grid gap-3 text-lg font-bold">
                  <p>Date: {date}</p>
                  <p>Time: {time}</p>
                  <p>Price: ${basePrice.toFixed(2)} per player</p>
                  <p>{seats} seats available</p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[18px] border-2 border-slate-950">
              <div className="border-b-2 border-slate-950 p-4 text-center text-xl font-black">
                How many players?
              </div>

              <div className="flex items-center justify-center gap-10 p-6">
                <button
                  onClick={() => setPlayers((value) => Math.max(1, value - 1))}
                  className="h-12 w-12 rounded-full border-2 border-orange-500 text-2xl font-black text-orange-500"
                >
                  -
                </button>

                <div className="text-5xl font-black text-orange-500">
                  {players}
                </div>

                <button
                  onClick={() =>
                    setPlayers((value) => Math.min(seats, value + 1))
                  }
                  className="h-12 w-12 rounded-full border-2 border-orange-500 text-2xl font-black text-orange-500"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-[18px] border-2 border-slate-950 p-6 shadow-lg">
            <h2 className="text-2xl font-black">Contact Information</h2>

            <div className="mt-6 grid gap-4">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full Name"
                className="rounded border-2 border-slate-300 p-4 font-bold"
              />

              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="rounded border-2 border-slate-300 p-4 font-bold"
              />

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone Number"
                type="tel"
                className="rounded border-2 border-slate-300 p-4 font-bold"
              />

              {error && (
                <p className="rounded bg-red-100 p-3 text-sm font-bold text-red-700">
                  {error}
                </p>
              )}

              <div className="mt-6 border-t-2 border-slate-200 pt-5">
                <p className="text-sm font-black uppercase text-slate-500">
                  Final total calculated on next step
                </p>
              </div>

              <button
                onClick={handleContinue}
                className="mt-4 rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
              >
                Continue
              </button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}