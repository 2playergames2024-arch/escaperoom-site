"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BookingTemporarilyUnavailablePage() {
  const router = useRouter();

  const [showStaffAccess, setShowStaffAccess] =
    useState(false);

  const [code, setCode] =
    useState("");

  const [error, setError] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleStaffAccess() {
    if (
      isSubmitting ||
      !code.trim()
    ) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response =
        await fetch(
          "/api/booking-test-access",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                code,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Invalid access code."
        );
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not enable staff booking access."
      );

      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-[18px] border-2 border-slate-950 p-8 text-center shadow-lg">
        <h1 className="text-4xl font-black">
          Online Booking Temporarily Unavailable
        </h1>

        <p className="mt-6 text-lg font-bold leading-8">
          We&apos;re temporarily unable to process online bookings.
        </p>

        <p className="mt-4 text-lg leading-8">
          Please contact Escape Room Mystery for assistance with your reservation.
        </p>

        <a
          href="/contact"
          className="mt-8 inline-block rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
        >
          Contact Us
        </a>

        <div className="mt-12 border-t border-slate-200 pt-6">
          {!showStaffAccess ? (
            <button
              type="button"
              onClick={() =>
                setShowStaffAccess(
                  true
                )
              }
              className="text-xs font-bold text-slate-400 hover:text-slate-700"
            >
              Staff Access
            </button>
          ) : (
            <div className="mx-auto max-w-sm">
              <label
                htmlFor="staff-booking-code"
                className="block text-left text-sm font-black"
              >
                Staff Booking Access
              </label>

              <input
                id="staff-booking-code"
                type="password"
                value={code}
                onChange={(event) =>
                  setCode(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    handleStaffAccess();
                  }
                }}
                autoComplete="off"
                className="mt-2 w-full rounded border-2 border-slate-300 px-4 py-3"
              />

              {error && (
                <p
                  role="alert"
                  className="mt-3 text-sm font-bold text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={
                  handleStaffAccess
                }
                disabled={
                  isSubmitting ||
                  !code.trim()
                }
                className="mt-4 w-full rounded bg-slate-950 px-6 py-3 font-black uppercase text-white disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting
                  ? "Checking..."
                  : "Enable Booking Access"}
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}