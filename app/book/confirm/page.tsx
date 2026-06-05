"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ConfirmPage() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState("Finalizing your booking...");
  const [bookingId, setBookingId] = useState("");

  const sessionId = searchParams.get("sessionId") || "";
  const [sessionData, setSessionData] = useState<any>(null);

  useEffect(() => {
    async function finalizeBooking() {
      try {
        const sessionRes = await fetch(
          `/api/booking-session?sessionId=${encodeURIComponent(sessionId)}`
        );

        const sessionJson = await sessionRes.json();

        if (!sessionRes.ok || !sessionJson.session) {
          setStatus("Payment was received, but booking details were missing. Please contact us.");
          return;
        }

        setSessionData(sessionJson.session);

        const res = await fetch("/api/bookeo/finalize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(sessionJson.session),
        });

        const data = await res.json();

        if (!res.ok) {
          console.log("Finalize booking failed:", data);
          setStatus("Payment was received, but the booking could not be finalized automatically. Please contact us.");
          return;
        }

        setBookingId(data?.data?.id || "");
        setStatus("Your booking is confirmed.");
      } catch (error) {
        console.log("Finalize booking crashed:", error);
        setStatus("Payment was received, but the booking could not be finalized automatically. Please contact us.");
      }
    }

    if (sessionId) {
      finalizeBooking();
    } else {
      setStatus("Payment was received, but booking session was missing. Please contact us.");
    }
  }, [sessionId]);

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Payment Received
        </p>

        <h1 className="mt-2 text-4xl font-black">Thank you!</h1>

        <p className="mt-6 text-lg font-bold">{status}</p>

        {bookingId && (
          <p className="mt-6 text-sm font-bold text-slate-500">
            Booking ID: {bookingId}
          </p>
        )}
      </section>
    </main>
  );
}