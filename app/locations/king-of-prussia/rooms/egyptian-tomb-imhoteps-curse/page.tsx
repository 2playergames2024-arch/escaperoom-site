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

export default function EgyptianTombPage() {
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
        {/* Hero */}
        <section
          className="relative overflow-hidden bg-slate-950 text-white"
          style={{ height: `${HERO_HEIGHT}px` }}
        >
          <Image
            src="/images/rooms/egyptian-tomb-homepage-01.jpg"
            alt="Egyptian Tomb - Imhotep's Curse escape room"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "50% 25%" }}
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
                Egyptian Tomb
              </div>

              <div className="mt-2 text-3xl md:text-5xl">
                Imhotep&apos;s Curse
              </div>
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

        {/* Mission + First Image */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                Your Mission
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                Enter the Tomb. Break Imhotep&apos;s Curse.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  For centuries, the tomb of Imhotep has remained sealed and
                  hidden from the outside world.
                </p>

                <p>
                  Now your team has entered the ancient burial chamber in search
                  of its secrets—but disturbing the tomb has awakened a deadly
                  curse.
                </p>

                <p>
                  Explore the chambers, uncover what Imhotep left behind, and
                  break the curse before the tomb seals forever.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  You have 60 minutes. Escape before the tomb claims you.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/egyptian-tomb-action-01.jpg"
              alt="Guests exploring clues inside the Egyptian Tomb"
              className="h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>
        </section>

        {/* Group Experience + Second Image */}
        <section className="border-y border-slate-100 bg-white px-6 py-16 md:py-20">
          <div className="section-two-layout mx-auto max-w-6xl">
            <div className="section-two-text">
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                Built for Your Team
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                Search the Chambers. Decode the Symbols. Escape the Curse.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Explore the tomb, examine ancient artifacts, decipher hidden
                  symbols, and work together to uncover the path forward.
                </p>

                <p>
                  Some players will notice details carved into the walls.
                  Others will recognize patterns, connect discoveries, or find
                  meaning in the objects hidden throughout the chambers.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  Every discovery brings your team one step closer to breaking
                  the curse and escaping the tomb.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/egyptian-tomb-teamwork-01.jpg"
              alt="A group working together inside the Egyptian Tomb"
              className="section-two-image h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>

          <style jsx>{`
            .section-two-layout {
              display: grid;
              grid-template-areas:
                "text"
                "image";
              gap: 2.5rem;
              align-items: center;
            }

            .section-two-text {
              grid-area: text;
            }

            .section-two-image {
              grid-area: image;
            }

            @media (min-width: 1024px) {
              .section-two-layout {
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
                grid-template-areas: "image text";
                gap: 3.5rem;
              }
            }
          `}</style>
        </section>

        {/* Step Inside + Third Image */}
        <section className="bg-slate-100 px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                Step Inside
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                Enter the Lost Tomb of Imhotep
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Step beyond the sealed entrance and into an ancient world of
                  carved stone walls, hidden chambers, mysterious symbols, and
                  secrets buried for centuries.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  The tomb is open. Will your team escape before it closes?
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/egyptian-tomb-atmosphere-01.jpg"
              alt="Inside the ancient and mysterious Egyptian Tomb"
              className="h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>
        </section>

        {/* Room Details */}
        <section className="bg-slate-950 px-6 py-16 text-white md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-400">
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

        {/* Final CTA */}
        <section className="bg-orange-500 px-6 py-16 text-center text-white md:py-20">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            Ready to Enter the Tomb?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Gather your team and face Imhotep&apos;s curse at our King of
            Prussia location.
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
        locationName="King of Prussia"
        streetAddress="840 First Avenue, Suite 500"
        cityStateZip="King of Prussia, PA 19406"
        phone="610-757-1053"
        bookHref="/locations/king-of-prussia/book-now"
        roomsHref="/locations/king-of-prussia#rooms"
      />
    </>
  );
}