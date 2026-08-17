"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

function ConfirmPageContent() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState("Verifying your payment...");
  const [bookingId, setBookingId] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const sessionId = searchParams.get("sessionId") || "";

  useEffect(() => {
    async function completeBooking() {
      setCanRetry(false);

      try {
        /*
         * STEP 1:
         * Independently verify the Authorize.net transaction.
         *
         * The webhook can sometimes arrive a few seconds after the
         * customer reaches this page, so retry briefly if necessary.
         */
        let paymentVerified = false;

        for (let attempt = 0; attempt < 10; attempt++) {
          const verifyRes = await fetch(
            "/api/authorize/verify-payment",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                sessionId,
              }),
            }
          );

          const verifyData = await verifyRes.json();

          if (verifyRes.ok && verifyData.verified) {
            paymentVerified = true;
            break;
          }

          if (verifyData.pending) {
            setStatus("Payment received. Verifying your payment...");

            await new Promise((resolve) =>
              setTimeout(resolve, 2000)
            );

            continue;
          }

          console.log(
            "Payment verification failed:",
            verifyData
          );

          setStatus(
            "We could not verify your payment automatically. Please try confirming again or contact us for assistance."
          );
          setCanRetry(true);
          return;
        }

        if (!paymentVerified) {
          setStatus(
            "Your payment is still being verified. Please try confirming again in a moment or contact us if your confirmation does not arrive shortly."
          );
          setCanRetry(true);
          return;
        }

        /*
         * STEP 2:
         * Payment has now been independently verified.
         * Ask our protected Bookeo endpoint to finalize the booking.
         */
        setStatus("Payment verified. Finalizing your booking...");

        const res = await fetch("/api/bookeo/finalize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          console.log("Finalize booking failed:", data);

          setStatus(
            "Your payment was received, but the booking could not be finalized automatically. Please try confirming again or contact us."
          );
          setCanRetry(true);
          return;
        }

        setBookingId(data?.data?.id || "");
        setStatus("Your booking is confirmed.");
      } catch (error) {
        console.log("Complete booking crashed:", error);

        setStatus(
          "Your payment may have been received, but we could not complete the booking automatically. Please try confirming again or contact us."
        );
        setCanRetry(true);
      }
    }

    if (sessionId) {
      completeBooking();
    }
  }, [sessionId, retryTrigger]);

  const displayedStatus = sessionId
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

        {canRetry && (
          <div className="mt-6 flex flex-wrap gap-4">
            <button
              type="button"
              onClick={() =>
                setRetryTrigger((value) => value + 1)
              }
              className="rounded-full bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
            >
              Retry Confirmation
            </button>

            <a
              href="/contact"
              className="rounded-full border-2 border-slate-950 px-6 py-3 font-black uppercase text-slate-950"
            >
              Contact Us
            </a>
          </div>
        )}

        {bookingId && (
          <p className="mt-6 text-sm font-bold text-slate-500">
            Booking ID: {bookingId}
          </p>
        )}
      </section>
    </main>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div>Finalizing your booking...</div>}>
      <ConfirmPageContent />
    </Suspense>
  );
}