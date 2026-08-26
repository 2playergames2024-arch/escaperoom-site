"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";

import {
  useSearchParams,
} from "next/navigation";

import {
  isValidBookingSessionId,
} from "../../lib/booking";

import {
  trackClarityEvent,
} from "../../lib/clarity";

import {
  trackGa4Purchase,
  type Ga4Purchase,
} from "../../lib/googleAnalytics";

import Link from "next/link";

function ConfirmPageContent() {
  const searchParams =
    useSearchParams();

  const sessionId =
    searchParams.get(
      "sessionId"
    ) || "";

  const validSessionId =
    isValidBookingSessionId(
      sessionId
    );

  const [status, setStatus] =
    useState(
      "Payment received. Confirming your reservation..."
    );

  const [bookingId, setBookingId] =
    useState("");

  const [needsRecovery, setNeedsRecovery] =
    useState(false);

  const [location, setLocation] =
    useState("");

  useEffect(() => {
    if (!validSessionId) {
      return;
    }

    let cancelled = false;

    let purchaseTracked = false;

    async function checkStatus() {
      try {
        const response =
          await fetch(
            "/api/booking-status",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  sessionId,
                }),

              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (cancelled) {
          return true;
        }

        if (
          response.ok &&
          data.status ===
          "confirmed"
        ) {
          setBookingId(
            data.bookingId || ""
          );

          setLocation(
            data.location || ""
          );

          setStatus(
            "Your booking is confirmed."
          );

          setNeedsRecovery(
            false
          );

          if (
            data.purchase &&
            !purchaseTracked
          ) {
            trackGa4Purchase(
              data.purchase as
              Ga4Purchase
            );

            purchaseTracked =
              true;
          }

          trackClarityEvent(
            "booking_completed"
          );

          return true;
        }

        if (
          response.ok &&
          data.status ===
          "needs_recovery"
        ) {
          setStatus(
            "Your payment was received, but your reservation needs our attention. Our staff has been alerted. Do not make another booking."
          );

          setNeedsRecovery(
            true
          );

          trackClarityEvent(
            "booking_finalization_failed"
          );

          return true;
        }

        if (
          response.ok &&
          data.status ===
          "finalizing"
        ) {
          setStatus(
            "Payment verified. Finalizing your reservation..."
          );

          return false;
        }

        if (
          response.ok &&
          data.status ===
          "payment_received"
        ) {
          setStatus(
            "Payment received. Confirming your reservation..."
          );

          return false;
        }

        setStatus(
          "Confirming your payment and reservation..."
        );

        return false;
      } catch {
        if (!cancelled) {
          setStatus(
            "Your payment may have been received. We are still checking your reservation status..."
          );
        }

        return false;
      }
    }

    async function monitorBooking() {
      /*
       * Poll for up to about two minutes.
       * The webhook normally completes much faster,
       * but this gives Authorize.Net and Bookeo time
       * during a temporarily slow response.
       */
      for (
        let attempt = 0;
        attempt < 60;
        attempt++
      ) {
        if (cancelled) {
          return;
        }

        const finished =
          await checkStatus();

        if (finished) {
          return;
        }

        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              2000
            )
        );
      }

      if (!cancelled) {
        setStatus(
          "Your payment may have been received, but your reservation is taking longer than expected to confirm. Please do not make another booking. Contact us if confirmation does not arrive shortly."
        );

        setNeedsRecovery(
          true
        );
      }
    }

    monitorBooking();

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    validSessionId,
  ]);

  const displayedStatus =
    validSessionId
      ? status
      : "Booking session was missing. Please contact us for assistance.";

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Payment Received
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Thank you!
        </h1>

        <p className="mt-6 text-lg font-bold">
          {displayedStatus}
        </p>

        {bookingId && (
          <p className="mt-6 text-sm font-bold text-slate-500">
            Booking ID:{" "}
            {bookingId}
          </p>
        )}

        {bookingId && (
          <div className="mt-8 flex flex-wrap gap-4">
            {location === "king-of-prussia" && (
              <Link
                href="/locations/king-of-prussia"
                className="rounded bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
              >
                Back to King of Prussia
              </Link>
            )}

            {location === "cherry-hill" && (
              <Link
                href="/locations/cherry-hill"
                className="rounded bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
              >
                Back to Cherry Hill
              </Link>
            )}

            <Link
              href="/"
              className="rounded border-2 border-slate-950 px-6 py-3 font-black uppercase text-slate-950"
            >
              Home
            </Link>
          </div>
        )}

        {needsRecovery && (
          <a
            href="/contact"
            className="mt-8 inline-block rounded-full border-2 border-slate-950 px-6 py-3 font-black uppercase text-slate-950"
          >
            Contact Us
          </a>
        )}
      </section>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div>
          Confirming your booking...
        </div>
      }
    >
      <ConfirmPageContent />
    </Suspense>
  );
}