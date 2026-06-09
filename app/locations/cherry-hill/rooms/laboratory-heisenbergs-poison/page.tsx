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

export default function LaboratoryPage() {
  return (
    <>
      <LocationHeader
        locationName="Cherry Hill, NJ"
        locationSubtitle="Garden State Park"
        homeHref="/locations/cherry-hill"
        roomsHref="/locations/cherry-hill#rooms"
        bookHref="/locations/cherry-hill/book-now"
      />

      <main className="min-h-screen bg-white text-slate-950">
        <section
          className="relative overflow-hidden bg-slate-950 text-white"
          style={{ height: `${HERO_HEIGHT}px` }}
        >
          <Image
            src="/images/rooms/laboratory-homepage-01.jpg"
            alt="Laboratory - Heisenberg's Poison escape room"
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
                Laboratory
              </div>

              <div className="mt-2 text-3xl md:text-5xl">
                Heisenberg's Poison
              </div>
            </h1>

            <div
              className="flex flex-col gap-4 sm:flex-row"
              style={{ marginTop: `${BUTTON_TOP_MARGIN}px` }}
            >
              <Link
                href="/locations/cherry-hill/book-now"
                className="rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-orange-600"
              >
                Book This Room
              </Link>

              <Link
                href="/locations/cherry-hill#rooms"
                className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
              >
                Back to Cherry Hill Rooms
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 py-20">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
            Your Mission
          </p>

          <h2 className="mb-6 text-4xl font-black md:text-5xl">
            A Deadly Formula Is Loose in the Lab
          </h2>

          <div className="space-y-5 text-lg leading-relaxed text-slate-700">
            <p>
              ...enter a dangerous laboratory where a brilliant scientist&apos;s
              work has taken a deadly turn. The poison is spreading, clues are
              hidden throughout the lab, and the clock is running. Solve the
              puzzles, uncover the antidote, and stop Heisenberg&apos;s poison
              before it is too late.
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
                ["Location", "Cherry Hill"],
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
            Ready to Enter the Laboratory?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Gather your team and book your mission at our Cherry Hill location.
          </p>

          <Link
            href="/locations/cherry-hill/book-now"
            className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
          >
            Book This Room
          </Link>
        </section>
      </main>

      <LocationFooter
        locationName="Cherry Hill, NJ"
        streetAddress="2040 Springdale Rd"
        cityStateZip="Cherry Hill, NJ 08003"
        phone="(215) 987-8784"
        bookHref="/locations/cherry-hill/book-now"
        roomsHref="/locations/cherry-hill#rooms"
      />
    </>
  );
}