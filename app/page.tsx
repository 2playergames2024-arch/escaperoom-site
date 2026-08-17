"use client";

import Link from "next/link";
import Image from "next/image";

const featuredRooms = [
  {
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
  },
  {
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-2xl font-black tracking-tight leading-none">
            <div>ESCAPE ROOM</div>
            <div>MYSTERY</div>
          </Link>

          <nav className="hidden items-center gap-10 text-sm font-bold uppercase md:flex">
            <Link
              href="/locations/king-of-prussia"
              className="block text-center leading-none"
            >
              <div>KING OF</div>
              <div>PRUSSIA</div>
            </Link>

            <Link
              href="/locations/cherry-hill"
              className="block text-center leading-none"
            >
              <div>CHERRY</div>
              <div>HILL</div>
            </Link>
          </nav>

          <a
            href="#locations"
            className="rounded-full bg-orange-500 px-6 py-3 text-center text-sm font-black uppercase leading-none text-white hover:bg-orange-600"
          >
            Choose
            <br />
            Location
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="absolute inset-0 h-full w-full object-cover opacity-55"
        >
          <source src="/videos/hero.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 bg-black/45" />

        <div className="relative mx-auto flex min-h-[680px] max-w-7xl flex-col items-center justify-center px-6 py-24 text-center">
          <p className="mb-4 text-sm font-black uppercase tracking-[0.3em] text-orange-400">
            King of Prussia, PA · Cherry Hill, NJ
          </p>

          <h1 className="mb-6 max-w-5xl text-5xl font-black leading-tight tracking-tight md:text-7xl">
            Choose Your Escape Room Adventure
          </h1>

          <p className="mb-10 max-w-3xl text-xl leading-relaxed text-slate-200 md:text-2xl">
            Immersive escape rooms, cinematic sets, challenging puzzles, and
            unforgettable missions for friends, families, parties, and teams.
          </p>

          <a
            href="#locations"
            className="rounded-full bg-orange-500 px-9 py-4 text-lg font-black uppercase text-white hover:bg-orange-600"
          >
            Choose Location
          </a>
        </div>
      </section>

      {/* Location Selector */}
      <section id="locations" className="bg-orange-500 px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <h2 className="text-4xl font-black md:text-5xl">
              Pick Your Location
            </h2>
            <p className="mt-3 text-xl font-semibold">
              Start by choosing where you want to play.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Link
              href="/locations/king-of-prussia"
              className="rounded-[28px] bg-white p-8 text-slate-950 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <p className="mb-2 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
                Pennsylvania
              </p>
              <h3 className="mb-3 text-4xl font-black">King of Prussia</h3>
              <p className="mb-6 text-lg text-slate-600">
                View rooms, see availability, and book your adventure at our
                King of Prussia location.
              </p>
              <span className="inline-block rounded-full bg-slate-950 px-6 py-3 font-black uppercase text-white">
                Choose King of Prussia
              </span>
            </Link>

            <Link
              href="/locations/cherry-hill"
              className="rounded-[28px] bg-slate-950 p-8 text-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <p className="mb-2 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
                New Jersey
              </p>
              <h3 className="mb-3 text-4xl font-black">Cherry Hill</h3>
              <p className="mb-6 text-lg text-slate-300">
                View rooms, see availability, and book your adventure at our
                Cherry Hill location.
              </p>
              <span className="inline-block rounded-full bg-orange-500 px-6 py-3 font-black uppercase text-white">
                Choose Cherry Hill
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Rooms */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
            Featured Experiences
          </p>
          <h2 className="text-4xl font-black md:text-5xl">
            Enter a Different World
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Explore immersive rooms built for teamwork, mystery, and
            unforgettable moments.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          {featuredRooms.map((room) => (
            <article
              key={room.name}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg"
            >
              <div className="relative h-72 bg-slate-900">
                <Image
                  src={room.image}
                  alt={room.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/25" />
              </div>

              <div className="p-7">
                <p className="mb-2 text-sm font-black uppercase tracking-[0.18em] text-orange-500">
                  Available in King of Prussia & Cherry Hill
                </p>

                <h3 className="mb-4 text-2xl font-black">{room.name}</h3>

                <p className="mb-6 text-slate-600">
                  Gather your team, solve the clues, and complete your mission
                  before time runs out.
                </p>

                <a
                  href="#locations"
                  className="inline-block rounded-full bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
                >
                  Choose Location
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Why Us */}
      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
              Why Escape Room Mystery
            </p>
            <h2 className="text-4xl font-black md:text-5xl">
              Built for Real Adventure
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              ["Immersive Sets", "Step into detailed environments designed to feel like real worlds."],
              ["Challenging Puzzles", "Work together through layered puzzles, clues, locks, props, and surprises."],
              ["Perfect for Groups", "Great for birthdays, families, date nights, corporate events, and teams."],
            ].map(([title, text]) => (
              <div key={title} className="rounded-[28px] border border-white/10 bg-white/5 p-8">
                <h3 className="mb-3 text-2xl font-black">{title}</h3>
                <p className="text-slate-300">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Events CTA */}
      <section className="mx-auto max-w-7xl px-6 py-20 text-center">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Parties & Private Events
        </p>

        <h2 className="mb-5 text-4xl font-black md:text-5xl">
          Bring Your Group Together
        </h2>

        <p className="mx-auto mb-4 max-w-4xl text-lg leading-relaxed text-slate-600">
          Escape rooms are perfect for birthdays, youth groups, team building,
          school groups, bachelor/bachelorette parties, and family nights.
        </p>

        <p className="mx-auto mb-8 max-w-3xl text-lg leading-relaxed text-slate-600">
          Contact us to start planning your event. Your event coordinator will
          email you or give you a call within 24 hours.
        </p>

        <Link
          href="/contact"
          className="inline-block rounded-full bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
        >
          Plan Your Event
        </Link>
      </section>

      {/* Final CTA */}
      <section className="bg-orange-500 px-6 py-20 text-center text-white">
        <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
          Ready to Start Your Adventure?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
          Choose a location and see live availability.
        </p>
        <a
          href="#locations"
          className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
        >
          Choose Location
        </a>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 px-6 py-10 text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-6 md:flex-row">
          <div>
            <div className="text-2xl font-black">ESCAPE ROOM MYSTERY</div>
            <p className="mt-2 text-slate-400">
              King of Prussia, PA · Cherry Hill, NJ
            </p>
          </div>

          <div className="flex gap-6 text-sm font-bold uppercase text-slate-300">
            <Link href="/locations/king-of-prussia" className="text-center">
              <div>KING OF</div>
              <div>PRUSSIA</div>
            </Link>

            <Link href="/locations/cherry-hill" className="text-center">
              <div>CHERRY</div>
              <div>HILL</div>
            </Link>
            <a href="#locations">Choose Location</a>
          </div>
        </div>
      </footer>
    </main>
  );
}