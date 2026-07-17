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
            src="/images/rooms/billionaires-den-homepage-01.jpg"
            alt="The Billionaire's Den - Inheritance escape room"
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
                The Billionaire&apos;s Den
              </div>

              <div className="mt-2 text-3xl md:text-5xl">
                Inheritance
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
                Enter the Den. Claim the Billionaire&apos;s Fortune.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Your eccentric Billionaire uncle has left behind a fortune,
                  but he never intended to make the inheritance easy.
                </p>

                <p>
                  Hidden throughout his private den are secrets, clues, and one
                  final challenge designed to test everyone who hopes to claim
                  his wealth.
                </p>

                <p>
                  Enter the den, uncover what your uncle concealed, and complete
                  his final game before the inheritance slips away.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  You have 60 minutes. Prove your team is worthy.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/billionaires-den-action-01.jpg"
              alt="Guests investigating the Billionaire's final challenge"
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
                Search the Den. Follow the Clues. Unlock the Inheritance.
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Explore the Billionaire&apos;s private collection, examine
                  unusual objects, connect hidden clues, and work together to
                  unravel the mystery behind his fortune.
                </p>

                <p>
                  Some players will notice details others miss. Others will
                  recognize patterns, connect discoveries, or find the next step
                  when the trail seems to disappear.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  Every discovery brings your team closer to the fortune waiting
                  at the end of the challenge.
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/billionaires-den-teamwork-01.jpg"
              alt="A group working together inside the Billionaire's Den"
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
                Enter a World Built by an Eccentric Billionaire
              </h2>

              <div className="space-y-5 text-lg leading-relaxed text-slate-700">
                <p>
                  Step inside a colorful private den filled with unusual
                  artwork, hidden compartments, strange inventions, and clues
                  left behind by a man who never did anything the ordinary way.
                </p>

                <p className="pt-1 text-xl font-black text-slate-950">
                  The fortune is hidden inside. Can your team uncover it?
                </p>
              </div>
            </div>

            <img
              src="/images/rooms/billionaires-den-atmosphere-01.jpg"
              alt="Inside the colorful and mysterious Billionaire's Den"
              className="h-auto w-full rounded-[32px] shadow-xl"
            />
          </div>
        </section>

        {/* Room Details */}
        <section className="bg-slate-950 px-6 py-16 text-white md:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-10 text-center">
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

        {/* Final CTA */}
        <section className="bg-orange-500 px-6 py-16 text-center text-white md:py-20">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            Ready to Claim the Inheritance?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Gather your team and take on the Billionaire&apos;s final challenge
            at our Cherry Hill location.
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