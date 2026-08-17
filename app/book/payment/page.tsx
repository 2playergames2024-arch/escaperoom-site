"use client";

import { LOCATIONS } from "../../data/locations";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function PaymentPageContent() {
  const searchParams = useSearchParams();
  const locationParam = searchParams.get("location");

  const location =
    locationParam === "cherry-hill"
      ? "cherry-hill"
      : "king-of-prussia";

  const locationData =
    location === "cherry-hill"
      ? LOCATIONS.cherryHill
      : LOCATIONS.kingOfPrussia;

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
  const promotionDiscount = Number(
    searchParams.get("promotionDiscount") || "0"
  );
  const fullName = searchParams.get("fullName") || "";
  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";

  const roomInfo =
    locationData.rooms[
      room as keyof typeof locationData.rooms
    ];

  const basePrice = roomInfo?.basePrice ?? 35.01;
  const playerCount = Number(players || "0");
  const finalTotal = Number(total || "0");
  const roomCharge = basePrice * playerCount;

  const taxRate =
    location === "cherry-hill"
      ? 0.06625
      : 0.10;

  const currentTax = roomCharge * taxRate;
  const currentTotal = roomCharge + currentTax;

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
          location,
          total,
        }),
      });

      const sessionData = await sessionResponse.json();

      if (!sessionResponse.ok) {
        if (sessionResponse.status === 429) {
          throw new Error(
            "Our booking system is temporarily busy. Please wait a few minutes and try again."
          );
        }

        throw new Error(
          "We couldn't start your booking. Please try again. If the problem continues, contact us and we'll be happy to help."
        );
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
          baseUrl: window.location.origin,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.token) {
        if (response.status === 429) {
          throw new Error(
            "Our payment system is temporarily busy. Please wait a few minutes and try again."
          );
        }

        throw new Error(
          "We couldn't open the secure payment form. Please try again. Your card has not been charged."
        );
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
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't start payment. Please try again."
      );
      setIsPaying(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Payment
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Review & Pay
        </h1>

        <div className="mt-8 grid gap-3 text-lg font-bold">
          <p>Room: {room}</p>
          <p>Date: {formattedDate}</p>
          <p>Time: {time}</p>
          <p>Players: {players}</p>

          <div className="mt-4 border-t-2 border-slate-200 pt-4">
            <div className="flex justify-between">
              <span>
                ${basePrice.toFixed(2)} × {players} players
              </span>
              <span>${roomCharge.toFixed(2)}</span>
            </div>

            <div className="mt-2 flex justify-between">
              <span>Amusement Tax</span>
              <span>${currentTax.toFixed(2)}</span>
            </div>

            <div className="mt-4 flex justify-between border-t-2 border-slate-300 pt-4 font-black">
              <span>Current Total</span>
              <span>${currentTotal.toFixed(2)}</span>
            </div>

            {promotionDiscount > 0 && (
              <div className="mt-4 flex justify-between">
                <span>Promotion/Voucher</span>
                <span>-${promotionDiscount.toFixed(2)}</span>
              </div>
            )}

            <div className="mt-4 flex justify-between border-t-2 border-slate-300 pt-4 text-2xl font-black">
              <span>Amount Due</span>
              <span>${finalTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
          <h2 className="text-2xl font-black text-orange-600">
            Escape Room Mystery Promise
          </h2>

          <p className="mt-4 text-lg font-black">
            Life happens. We&apos;ve got you covered.
          </p>

          <p className="mt-2 text-lg font-black">
            No hassle. No stress.
          </p>

          <p className="mt-4 text-lg leading-8">
            If something comes up, just call us{" "}
            <strong>any time before your scheduled game</strong>.
            We&apos;ll take care of you.
          </p>
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
          href={`/locations/${location}/book-now`}
          className="mt-6 inline-block text-sm font-black uppercase text-orange-500"
        >
          ← Change Room, Date, or Time
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