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
        {/* Hero */}
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
            style={{ objectPosition: "50% 05%" }}
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
                Heisenberg&apos;s Poison
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

        {/* Mission + First Image */}
        <section className="px-6 py-16 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-3 text-2xl font-black uppercase tracking-[0.18em] text-orange-500">
                Your Mission
              </p>

              <h2 className="mb-7 text-4xl font-black leading-tight md:text-5xl">
                Enter the Laboratory. Find the Antidote.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  A brilliant scientist&apos;s experiment has taken a deadly
                  turn, and Heisenberg&apos;s poison is spreading.
                </p>

                <p>
                  Your team has entered the laboratory in search of the formula
                  that can stop it—but the scientist has hidden his work behind
                  experiments, strange technology, and dangerous secrets.
                </p>

                <p>
                  Search the lab, uncover what Heisenberg concealed, and create
                  the antidote before the poison escapes containment.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  You have 60 minutes. Find the cure before time runs out.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/laboratory-action-01.jpg"
              alt="Guests investigating clues inside Heisenberg's Laboratory"
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
                Examine the Evidence. Test the Formula. Stop the Poison.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Investigate the laboratory, examine unusual experiments,
                  connect hidden clues, and work together to uncover the formula
                  behind Heisenberg&apos;s poison.
                </p>

                <p>
                  Some players will notice small details. Others will recognize
                  patterns, understand how the experiments connect, or discover
                  the next step when the solution seems impossible.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  Every discovery brings your team closer to the antidote—and
                  closer to stopping the threat.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/laboratory-teamwork-01.jpg"
              alt="Guests working together during the Laboratory mission"
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
                Enter Heisenberg&apos;s Secret Laboratory
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Step into a laboratory filled with unusual experiments,
                  mysterious chemicals, hidden research, strange equipment, and
                  evidence of a discovery that was never meant to leave the lab.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  The poison is spreading. Can your team uncover the antidote?
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/laboratory-atmosphere-01.jpg"
              alt="Inside Heisenberg's mysterious Laboratory"
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

        {/* Final CTA */}
        <section className="bg-orange-500 px-6 py-16 text-center text-white md:py-20">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            Ready to Enter the Laboratory?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Gather your team and search for the antidote at our Cherry Hill
            location.
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
        locationName="Cherry Hill"
        streetAddress="1200 Haddonfield Road, 2nd Floor"
        cityStateZip="Cherry Hill, NJ 08002"
        phone="610-757-1053"
        bookHref="/locations/cherry-hill/book-now"
        roomsHref="/locations/cherry-hill#rooms"
      />
    </>
  );
}