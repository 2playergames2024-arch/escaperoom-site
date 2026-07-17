"use client";

import { LOCATIONS } from "../../data/locations";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const [isPaying, setIsPaying] = useState(false);
  const [error, setError] = useState("");

  const holdId = searchParams.get("holdId") || "";
  const productId = searchParams.get("productId") || "";
  const eventId = searchParams.get("eventId") || "";
  const room = searchParams.get("room") || "";
  const date = searchParams.get("date") || "";

  const formattedDate = date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const time = searchParams.get("time") || "";
  const players = searchParams.get("players") || "";
  const total = searchParams.get("total") || "";
  const fullName = searchParams.get("fullName") || "";
  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";

  const roomInfo =
    LOCATIONS.kingOfPrussia.rooms[
      room as keyof typeof LOCATIONS.kingOfPrussia.rooms
    ];

  const basePrice = roomInfo?.basePrice ?? 35.01;
  const playerCount = Number(players || "0");
  const subtotal = basePrice * playerCount;
  const finalTotal = Number(total || "0");
  const taxAmount = Math.max(0, finalTotal - subtotal);

  const nameParts = fullName.trim().split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  async function handlePayNow() {
    setIsPaying(true);
    setError("");

    try {
      const sessionResponse = await fetch("/api/booking-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          holdId,
          productId,
          eventId,
          players,
          firstName,
          lastName,
          email,
          phone,
          total,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        throw new Error("Could not create booking session.");
      }

      const sessionId = sessionData.sessionId;  

      const response = await fetch("/api/authorize/hosted-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Number(total),
          sessionId,
          holdId,
          productId,
          eventId,
          players,
          description: room,
          email,
          firstName,
          lastName,
          phone,
          baseUrl: "https://escaperoom-site-ikgr.vercel.app",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        throw new Error(data.error || "Could not start payment.");
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = "https://accept.authorize.net/payment/payment";
      form.style.display = "none";

      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "token";
      tokenInput.value = data.token;

      form.appendChild(tokenInput);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
      setIsPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Payment
        </p>

        <h1 className="mt-2 text-4xl font-black">Review & Pay</h1>

        <div className="mt-8 grid gap-3 text-lg font-bold">
          <p>Room: {room}</p>
          <p>Date: {formattedDate}</p>
          <p>Time: {time}</p>
          <p>Players: {players}</p>

          <div className="mt-4 border-t-2 border-slate-200 pt-4">
            <div className="flex justify-between">
              <span>${basePrice.toFixed(2)} x {players} players</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>

            <div className="mt-2 flex justify-between">
              <span>Amusement Tax</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>

            <div className="mt-4 flex justify-between border-t-2 border-slate-300 pt-4 text-2xl font-black">
              <span>Total</span>
              <span>${finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded bg-slate-100 p-5 text-sm font-bold">
          <p>Name: {fullName}</p>
          <p>Email: {email}</p>
          <p>Phone: {phone}</p>
          <p className="mt-3 text-xs text-slate-500">Hold ID: {holdId}</p>
        </div>

        {error && (
          <div className="mt-6 rounded border border-red-500 bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handlePayNow}
          disabled={isPaying}
          className="mt-8 w-full rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isPaying ? "Starting Payment..." : "Pay Now"}
        </button>

        <Link
          href="/locations/king-of-prussia/book-now"
          className="mt-6 inline-block text-sm font-black uppercase text-orange-500"
        >
          ← Start Over
        </Link>
      </section>
    </main>
  );
}
export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading payment...</main>}>
      <PaymentPageContent />
    </Suspense>
  );
}
