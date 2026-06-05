"use client";

import Link from "next/link";
import Image from "next/image";

export default function EgyptianTombPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Hero */}
      <section className="relative min-h-[620px] overflow-hidden bg-slate-950 text-white">
        <Image
          src="/images/rooms/egyptian-tomb-homepage-01.jpg"
          alt="Egyptian Tomb - Imhotep's Curse escape room"
          fill
          priority
          className="object-cover"
        />

        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 mx-auto flex min-h-[620px] max-w-7xl flex-col justify-center px-6 py-24">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
            King of Prussia, PA
          </p>

          <h1 className="mb-6 max-w-4xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            Egyptian Tomb - Imhotep&apos;s Curse
          </h1>

          <p className="mb-8 max-w-2xl text-xl leading-relaxed text-slate-200 md:text-2xl">
            Enter the tomb. Break the curse. Escape before you become part of
            the legend.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/locations/king-of-prussia/book-now"
              className="rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-orange-600"
            >
              Book This Room
            </Link>

            <Link
              href="/locations/king-of-prussia"
              className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
            >
              Back to KOP Rooms
            </Link>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Your Mission
        </p>

        <h2 className="mb-6 text-4xl font-black md:text-5xl">
          The Tomb Has Been Sealed for Centuries
        </h2>

        <div className="space-y-5 text-lg leading-relaxed text-slate-700">
          <p>
            You and your team have entered an ancient Egyptian tomb filled with
            mystery, hidden chambers, and secrets left behind by Imhotep.
          </p>

          <p>
            The curse has awakened, and time is running out. Solve the clues,
            uncover the truth, and escape before the tomb claims you forever.
          </p>
        </div>
      </section>

      {/* Details */}
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

      {/* Final CTA */}
      <section className="bg-orange-500 px-6 py-20 text-center text-white">
        <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
          Ready to Enter the Tomb?
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
  );
}