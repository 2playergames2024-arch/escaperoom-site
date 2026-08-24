"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import LocationHeader from "../../components/LocationHeader";
import {
  LOCATIONS,
} from "../../data/locations";

export default function GiftVoucherCheckoutClient() {
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
            We can&apos;t open a gift-voucher checkout without
            a valid location. Please choose one below.
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

  const giftVoucherFile =
    location.slug ===
      LOCATIONS.cherryHill.slug
      ? "/bookeo-gift-ch.html"
      : "/bookeo-gift-kop.html";

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
        bookHref={location.bookHref}
        giftVoucherMode
      />

      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-4">
            <a
              href={`/gift-vouchers/details?location=${location.slug}`}
              className="font-bold text-orange-600 hover:underline"
            >
              ← Change gift voucher location
            </a>
          </div>
          <iframe
            src={
              giftVoucherFile
            }
            title={`Purchase a gift voucher for ${location.shortName}`}
            className="w-full border-0"
            style={{
              height: "900px",
              minHeight: "800px",
            }}
          />
        </div>
      </main>
    </>
  );
}
