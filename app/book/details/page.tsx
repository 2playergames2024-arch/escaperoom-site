"use client";

import {
  getLocationBySlug,
  getRoomByProductId,
} from "../../data/locations";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  isValidCalendarDate,
} from "../../lib/booking";
import {
  trackClarityEvent,
} from "../../lib/clarity";

function BookingDetailsPageContent() {
  const searchParams = useSearchParams();

  const location = searchParams.get("location") || "";
  const productId = searchParams.get("productId") || "";
  const eventId = searchParams.get("eventId") || "";
  const date = searchParams.get("date") || "";
  const time = searchParams.get("time") || "";
  const seats = Number(searchParams.get("seats") || "0");

  const locationData = getLocationBySlug(location);
  const roomInfo = getRoomByProductId(
    location,
    productId
  );

  const validBookingSelection =
    Boolean(locationData) &&
    Boolean(roomInfo) &&
    Boolean(eventId) &&
    isValidCalendarDate(date) &&
    Boolean(time) &&
    Number.isInteger(seats) &&
    seats > 0;

  const formattedDate =
    validBookingSelection && date
      ? new Date(
        `${date}T12:00:00`
      ).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      : "";

  const isSaturday =
    validBookingSelection && date
      ? new Date(
        `${date}T12:00:00`
      ).getDay() === 6
      : false;

  const minimumPlayers = roomInfo
    ? isSaturday
      ? roomInfo.saturdayMinPlayers
      : roomInfo.minPlayers
    : 2;

  const maximumPlayers = roomInfo
    ? Math.min(
      roomInfo.maxPlayers,
      Number.isFinite(seats) ? seats : roomInfo.maxPlayers
    )
    : 10;

  const minimumPlayerText = isSaturday
    ? `Minimum ${minimumPlayers} players • Saturdays only`
    : `Minimum ${minimumPlayers} players`;

  const [players, setPlayers] =
    useState(minimumPlayers);

  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [promoCode, setPromoCode] =
    useState("");

  const [error, setError] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  if (!validBookingSelection || !locationData || !roomInfo) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-2xl rounded-[18px] border-2 border-slate-950 p-8 text-center shadow-lg">
          <h1 className="text-3xl font-black">
            Booking Selection Expired
          </h1>

          <p className="mt-4 text-lg font-semibold text-slate-600">
            We could not verify the room and time for this booking.
            Please choose your room and time again.
          </p>

          <Link
            href={
              locationData
                ? locationData.bookHref
                : "/"
            }
            className="mt-8 inline-block rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
          >
            Start Booking Again
          </Link>
        </section>
      </main>
    );
  }

  async function handleContinue() {
    if (isSubmitting) {
      return;
    }

    setError("");

    const cleanedName =
      fullName.trim();

    const nameParts =
      cleanedName.split(/\s+/);

    const firstName =
      nameParts[0] || "";

    const lastName =
      nameParts.slice(1).join(" ");

    if (!firstName || !lastName) {
      setError(
        "Please enter your first and last name."
      );
      return;
    }

    if (!email.trim()) {
      setError(
        "Please enter your email."
      );
      return;
    }

    if (!phone.trim()) {
      setError(
        "Please enter your phone number."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * STEP 1:
       * Ask the server to create a Bookeo hold.
       *
       * The server validates the location, product,
       * participant rules and Bookeo response.
       */
      const holdResponse = await fetch(
        "/api/bookeo/hold",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            location,
            productId,
            eventId,
            date,
            time,
            players,
            promoCode,
          }),
        }
      );

      const holdData =
        await holdResponse.json();

      if (!holdResponse.ok) {
        if (holdResponse.status === 429) {
          throw new Error(
            "Our booking system is temporarily busy. Please wait a few minutes and try again."
          );
        }

        throw new Error(
          holdData.message ||
          holdData.error ||
          "Could not create booking hold."
        );
      }

      const holdId =
        String(holdData?.data?.id || "");

      if (!holdId) {
        throw new Error(
          "The booking hold was created without a valid hold ID. Please try again."
        );
      }

      /*
       * STEP 2:
       * Create the server-side booking session.
       *
       * We only send the hold ID and contact details.
       * Product/event/price/location information comes
       * from the trusted hold stored by our server.
       */
      const sessionResponse = await fetch(
        "/api/booking-session",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            holdId,
            firstName,
            lastName,
            email: email.trim(),
            phone: phone.trim(),
          }),
        }
      );

      const sessionData =
        await sessionResponse.json();

      if (!sessionResponse.ok) {
        if (sessionResponse.status === 429) {
          throw new Error(
            "Our booking system is temporarily busy. Please wait a few minutes and try again."
          );
        }

        throw new Error(
          sessionData.error ||
          "Could not create booking session."
        );
      }

      const sessionId =
        String(sessionData.sessionId || "");

      if (!sessionId) {
        throw new Error(
          "Booking session could not be created."
        );
      }

      /*
 * The booking hold and trusted session
 * were created successfully.
 */
      trackClarityEvent(
        "booking_started"
      );

      /*
       * The payment URL now contains only the
       * opaque server-generated session ID.
       */
      window.location.href =
        `/book/payment?sessionId=${encodeURIComponent(
          sessionId
        )}`;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't continue your booking. Please try again."
      );

      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="mx-auto max-w-6xl px-6 py-12">
        <Link
          href={`${locationData.bookHref}?date=${encodeURIComponent(
            date
          )}`}
          className="mb-8 inline-block text-sm font-black uppercase text-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-300"
        >
          ← Back to Rooms & Times
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          <section>
            <h1 className="text-4xl font-black">
              Booking Details
            </h1>

            <div className="mt-8 overflow-hidden rounded-[18px] border-2 border-slate-950">
              <div className="relative h-64 bg-slate-900">
                <Image
                  src={roomInfo.image}
                  alt={roomInfo.name}
                  fill
                  className="object-cover"
                  style={{
                    objectPosition: "50% 10%",
                  }}
                  sizes="(max-width: 768px) 100vw, 60vw"
                />

                <div className="absolute inset-0 bg-black/25" />
              </div>

              <div className="p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
                  Selected Room
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {roomInfo.name}
                </h2>

                <div className="mt-6 grid gap-3 text-lg font-bold">
                  <p>
                    Date: {formattedDate}
                  </p>

                  <p>
                    Time: {time}
                  </p>

                  <p>
                    Price: $
                    {roomInfo.basePrice.toFixed(
                      2
                    )}{" "}
                    per player
                  </p>

                  <p>
                    {seats} seats available
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-[18px] border-2 border-slate-950">
              <div className="border-b-2 border-slate-950 p-4 text-center">
                <div className="text-xl font-black">
                  How many players?
                </div>

                <p className="mt-2 text-sm font-bold text-slate-600">
                  {minimumPlayerText}
                </p>
              </div>

              <div className="flex items-center justify-center gap-10 p-6">
                <button
                  type="button"
                  aria-label="Remove player"
                  onClick={() =>
                    setPlayers((value: number) =>
                      Math.max(
                        minimumPlayers,
                        value - 1
                      )
                    )
                  }
                  className="h-12 w-12 rounded-full border-2 border-orange-500 text-2xl font-black text-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-300"
                >
                  -
                </button>

                <div
                  className="text-5xl font-black text-orange-500"
                  aria-live="polite"
                  aria-label={`${players} players`}
                >
                  {players}
                </div>

                <button
                  type="button"
                  aria-label="Add player"
                  onClick={() =>
                    setPlayers((value: number) =>
                      Math.min(
                        maximumPlayers,
                        value + 1
                      )
                    )
                  }
                  disabled={
                    players >= maximumPlayers
                  }
                  className="h-12 w-12 rounded-full border-2 border-orange-500 text-2xl font-black text-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <aside className="h-fit rounded-[18px] border-2 border-slate-950 p-6 shadow-lg">
            <h2 className="text-2xl font-black">
              Contact Information
            </h2>

            <div className="mt-6 grid gap-4">
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block font-bold"
                >
                  Full Name
                </label>

                <input
                  id="fullName"
                  name="fullName"
                  value={fullName}
                  onChange={(event) =>
                    setFullName(
                      event.target.value
                    )
                  }
                  autoComplete="name"
                  maxLength={200}
                  className="w-full rounded border-2 border-slate-300 p-4 font-bold focus:outline-none focus:ring-4 focus:ring-orange-300"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block font-bold"
                >
                  Email
                </label>

                <input
                  id="email"
                  name="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  type="email"
                  autoComplete="email"
                  maxLength={254}
                  className="w-full rounded border-2 border-slate-300 p-4 font-bold focus:outline-none focus:ring-4 focus:ring-orange-300"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block font-bold"
                >
                  Phone Number
                </label>

                <input
                  id="phone"
                  name="phone"
                  value={phone}
                  onChange={(event) =>
                    setPhone(
                      event.target.value
                    )
                  }
                  type="tel"
                  autoComplete="tel"
                  maxLength={40}
                  className="w-full rounded border-2 border-slate-300 p-4 font-bold focus:outline-none focus:ring-4 focus:ring-orange-300"
                />
              </div>

              <div>
                <label
                  htmlFor="promoCode"
                  className="mb-2 block font-bold"
                >
                  Gift Voucher or Promo Code
                  <span className="ml-1 font-normal text-slate-500">
                    (optional)
                  </span>
                </label>

                <input
                  id="promoCode"
                  name="promoCode"
                  value={promoCode}
                  onChange={(event) =>
                    setPromoCode(
                      event.target.value
                    )
                  }
                  maxLength={100}
                  className="w-full rounded border-2 border-slate-300 p-4 font-bold focus:outline-none focus:ring-4 focus:ring-orange-300"
                />
              </div>

              {error && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="rounded bg-red-100 p-3 text-sm font-bold text-red-700"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 border-t-2 border-slate-200 pt-5">
                <p className="text-sm font-black uppercase text-slate-500">
                  Final total calculated on next step
                </p>
              </div>

              <button
                type="button"
                onClick={handleContinue}
                disabled={isSubmitting}
                className="mt-4 rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-300 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSubmitting
                  ? "Securing Booking..."
                  : "Continue"}
              </button>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

export default function BookingDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          Loading booking details...
        </main>
      }
    >
      <BookingDetailsPageContent />
    </Suspense>
  );
}