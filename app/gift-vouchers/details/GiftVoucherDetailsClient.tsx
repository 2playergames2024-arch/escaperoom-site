"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import LocationHeader from "../../components/LocationHeader";
import {
  LOCATIONS,
} from "../../data/locations";
import {
  trackClarityEvent,
} from "../../lib/clarity";

export default function GiftVoucherDetailsClient() {
  const searchParams =
    useSearchParams();

  const locationParam =
    searchParams.get("location");

  const location =
    locationParam ===
    LOCATIONS.kingOfPrussia.slug
      ? LOCATIONS.kingOfPrussia
      : locationParam ===
          LOCATIONS.cherryHill.slug
        ? LOCATIONS.cherryHill
        : null;

  if (!location) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
            Gift Vouchers
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Choose a Location
          </h1>

          <p className="mt-6 text-lg">
            Gift vouchers are location-specific.
            Please choose the location where the voucher will be used.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link
              href={`/gift-vouchers/details?location=${LOCATIONS.kingOfPrussia.slug}`}
              className="rounded-lg bg-orange-500 px-6 py-4 text-center text-lg font-black text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            >
              {LOCATIONS.kingOfPrussia.shortName}
            </Link>

            <Link
              href={`/gift-vouchers/details?location=${LOCATIONS.cherryHill.slug}`}
              className="rounded-lg bg-orange-500 px-6 py-4 text-center text-lg font-black text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            >
              {LOCATIONS.cherryHill.shortName}
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const otherLocation =
    location.slug ===
    LOCATIONS.cherryHill.slug
      ? LOCATIONS.kingOfPrussia
      : LOCATIONS.cherryHill;

  const otherLocationHref =
    `/gift-vouchers/details?location=${otherLocation.slug}`;

  const checkoutHref =
    `/gift-vouchers/checkout?location=${location.slug}`;

  return (
    <>
      <LocationHeader
        locationName={`${location.shortName}, ${location.state}`}
        locationSubtitle={
          location.subtitle
        }
        homeHref={
          location.homeHref
        }
        roomsHref={
          location.roomsHref
        }
        bookHref={
          location.bookHref
        }
      />

      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
            Gift Vouchers
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Purchase a Gift Voucher
          </h1>

          <div className="mt-8 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
            <p className="text-xl font-black">
              Purchasing for:
            </p>

            <p className="mt-2 text-3xl font-black text-orange-600">
              {location.shortName}
            </p>

            <p className="mt-6 text-lg">
              Gift vouchers are valid only
              at this location.
            </p>

            <Link
              href={
                otherLocationHref
              }
              className="mt-6 inline-block font-bold text-orange-600 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            >
              Need a gift voucher for{" "}
              {otherLocation.shortName}{" "}
              instead?
            </Link>
          </div>

          <div className="mt-12 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
            <h2 className="text-2xl font-black">
              Continue to Secure Checkout
            </h2>

            <p className="mt-4 text-lg">
              Gift voucher purchases are
              securely processed by Bookeo.
              Click Continue below to select
              your gift voucher, enter the
              purchaser information, and
              complete payment.
            </p>

            <Link
              href={checkoutHref}
              onClick={() => {
                trackClarityEvent(
                  "gift_voucher_checkout_started"
                );
              }}
              className="mt-8 block w-full rounded-lg bg-orange-500 px-6 py-4 text-center text-xl font-black text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
            >
              Continue
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
