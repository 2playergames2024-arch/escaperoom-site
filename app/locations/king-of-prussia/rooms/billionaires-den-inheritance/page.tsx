"use client";

import Link from "next/link";
import Image from "next/image";
import LocationHeader from "../../../../components/LocationHeader";
import LocationFooter from "../../../../components/LocationFooter";

// ======================================
// HERO TUNING CONTROLS
// ======================================
const HERO_HEIGHT = 620;
const HERO_TOP_PADDING = 60;
const HERO_LEFT_OFFSET = 0;
const BUTTON_TOP_MARGIN = 230;
const OVERLAY_OPACITY = 0.15;
const TITLE_TEXT_SHADOW = "2px 2px 4px rgba(0,0,0,0.8)";

export default function BillionairesDenPage() {
  return (
    <>
      <LocationHeader
        locationName="King of Prussia, PA"
        locationSubtitle="Moore Park"
        homeHref="/locations/king-of-prussia"
        roomsHref="/locations/king-of-prussia#rooms"
        bookHref="/locations/king-of-prussia/book-now"
      />

      <main className="min-h-screen bg-white text-slate-950">
        <section
          className="relative overflow-hidden bg-slate-950 text-white"
          style={{ height: `${HERO_HEIGHT}px` }}
        >
          <Image
            src="/images/rooms/billionaires-den-homepage-01.jpg"
            alt="The Billionaire's Den - Inheritance escape room"
            fill
            priority
            className="object-cover"
          />

          <div
            className="absolute inset-0"
            style={{
              backgroundColor: `rgba(0, 0, 0, ${OVERLAY_OPACITY})`,
            }}
          />

          <div
            className="relative z-10 mx-auto max-w-7xl px-6"
            style={{
              paddingTop: `${HERO_TOP_PADDING}px`,
              transform: `translateX(${HERO_LEFT_OFFSET}px)`,
            }}
          >
            <h1
              className="max-w-4xl font-black leading-tight tracking-tight"
              style={{ textShadow: TITLE_TEXT_SHADOW }}
            >
              <div className="text-4xl md:text-6xl">
                The Billionaire&apos;s Den
              </div>

              <div className="mt-2 text-3xl md:text-5xl">Inheritance</div>
            </h1>

            <div
              className="flex flex-col gap-4 sm:flex-row"
              style={{ marginTop: `${BUTTON_TOP_MARGIN}px` }}
            >
              <Link
                href="/locations/king-of-prussia/book-now"
                className="rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-orange-600"
              >
                Book This Room
              </Link>

              <Link
                href="/locations/king-of-prussia#rooms"
                className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
              >
                Back to KOP Rooms
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
            Your Mission
          </p>

          <h2 className="mb-6 text-4xl font-black md:text-5xl">
            Your Eccentric Uncle Left Behind a Fortune
          </h2>

          <div className="space-y-5 text-lg leading-relaxed text-slate-700">
            <p>
              ...but claiming the inheritance will not be easy. Hidden inside his
              private den are clues, puzzles, secrets, and one final challenge.
              Work together, prove yourselves worthy, and solve his final game
              before the inheritance slips away.
            </p>
          </div>
        </section>

        <section className="bg-slate-950 px-6 py-20 text-white">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
                Room Details
              </p>
              <h2 className="text-4xl font-black md:text-5xl">
                Plan Your Escape
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {[
                ["Duration", "60 Minutes"],
                ["Players", "2–10 Players"],
                ["Location", "King of Prussia"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[28px] border border-white/10 bg-white/5 p-8 text-center"
                >
                  <p className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-orange-400">
                    {label}
                  </p>
                  <h3 className="text-3xl font-black">{value}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-orange-500 px-6 py-20 text-center text-white">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            Ready to Claim the Inheritance?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Gather your team and book your mission at our King of Prussia
            location.
          </p>

          <Link
            href="/locations/king-of-prussia/book-now"
            className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
          >
            Book This Room
          </Link>
        </section>
      </main>

      <LocationFooter
        locationName="King of Prussia, PA"
        streetAddress="1030 W 8th Ave"
        cityStateZip="King of Prussia, PA 19406"
        phone="(215) 987-8784"
        bookHref="/locations/king-of-prussia/book-now"
        roomsHref="/locations/king-of-prussia#rooms"
      />
    </>
  );
}