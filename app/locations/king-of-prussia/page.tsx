"use client";

import LocationFooter from "@/app/components/LocationFooter";
import LocationHeader from "@/app/components/LocationHeader";
import Link from "next/link";
import Image from "next/image";

const rooms = [
  {
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
    href: "/locations/king-of-prussia/rooms/area-51-annihilation",
    bookHref: "/locations/king-of-prussia/book-now?room=area-51",
    description: "Stop the Alien threat before it reaches Earth.",
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
    href: "/locations/king-of-prussia/rooms/egyptian-tomb-imhoteps-curse",
    bookHref: "/locations/king-of-prussia/book-now?room=egyptian-tomb",
    description: "Break the Pharaoh’s curse before the tomb seals forever.",
  },
  {
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
    href: "/locations/king-of-prussia/rooms/billionaires-den-inheritance",
    bookHref: "/locations/king-of-prussia/book-now?room=billionaires-den",
    description: "Uncover the fortune hidden inside a Billionaire’s final challenge.",
  },
  {
    name: "Revolution Spies - Patriotism",
    image: "/images/rooms/revolution-spies-homepage-01.jpg",
    href: "/locations/king-of-prussia/rooms/revolution-spies-patriotism",
    bookHref: "/locations/king-of-prussia/book-now?room=revolution-spies",
    description: "Outwit the enemy and help turn the tide of the Revolution.",
  },
];

export default function KingOfPrussiaPage() {
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
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] [background-size:36px_36px] opacity-30" />

        <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">

          {/* FULL-WIDTH HERO HEADING */}
          <div>
            <p className="mb-5 text-2xl font-black uppercase tracking-[0.10em] text-orange-400">
              King of Prussia, PA
            </p>

            <h1 className="max-w-full text-5xl font-black leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
              Bring your group. We&apos;ll handle the fun.
            </h1>
          </div>

          {/* LOWER HERO CONTENT */}
          <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">

            {/* VIDEO
                On narrower screens, the video appears first.
                On large desktop screens, it moves to the right.
            */}
            <div className="order-1 lg:order-2">
              <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
                <div className="relative h-[340px] overflow-hidden rounded-[24px] md:h-[380px]">
                  <video
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full object-cover"
                    onTimeUpdate={(e) => {
                      const video = e.currentTarget;

                      if (video.currentTime >= 17) {
                        video.currentTime = 0;
                        video.play();
                      }
                    }}
                  >
                    <source
                      src="/videos/hero.mp4"
                      type="video/mp4"
                    />
                  </video>

                  <div className="absolute inset-0 bg-black/25" />
                </div>
              </div>
            </div>

            {/* CREDIBILITY + AWARD + BUTTONS */}
            <div className="order-2 lg:order-1">

              {/* CORE CREDIBILITY */}
              <p className="text-lg font-black uppercase leading-relaxed tracking-[0.03em] text-white md:text-xl">
                Custom-Built Adventures
                <span className="mx-2 text-orange-400">•</span>
                Family Owned
                <span className="mx-2 text-orange-400">•</span>
                10 Years Strong
              </p>

              {/* GOOGLE + PRIVATE ROOMS */}
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-4">

                <div className="text-lg font-black text-white md:text-xl">
                  <span className="text-yellow-400">
                    ★★★★★
                  </span>

                  <span className="ml-2">
                    5.0 on Google
                  </span>
                </div>

                <div
                  className="text-lg font-black uppercase tracking-[0.05em] text-orange-400 md:text-xl"
                  style={{
                    marginLeft: "32px",
                  }}
                >
                  Always Private Rooms
                </div>

              </div>

              {/* COMPACT AWARD PANEL */}
              <div className="mt-7 flex max-w-xl items-center justify-between gap-5 rounded-2xl border border-white/20 bg-white/5 px-5 py-4">

                <div>
                  <p className="text-2xl font-black uppercase tracking-[0.04em] text-orange-400 md:text-3xl">
                    Best of 2026
                  </p>

                  <p className="mt-1 text-sm font-black uppercase tracking-[0.08em] text-white md:text-base">
                    BusinessRate Award Winner
                  </p>
                </div>

                <Image
                  src="/images/awards/businessrate-best-of-2026.png"
                  alt="BusinessRate Best of 2026 Award Winner"
                  width={220}
                  height={180}
                  className="h-auto w-28 shrink-0 md:w-36"
                />

              </div>

              {/* BUTTONS */}
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">

                <Link
                  href="/locations/king-of-prussia/book-now"
                  className="flex-1 rounded-full bg-orange-500 px-5 py-3 text-center font-black uppercase text-white"
                >
                  Book
                </Link>

                <a
                  href="#rooms"
                  className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
                >
                  View Rooms
                </a>

              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 text-lg font-black uppercase tracking-[0.2em] text-orange-500">
            What will you Conquer?
          </p>
          <h2 className="text-4xl font-black md:text-5xl">
            One-of-a-Kind Adventures
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Designed by people who love escape rooms for people who love great adventures.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {rooms.map((room) => (
            <article
              key={room.name}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg"
            >
              <Link href={room.href}>
                <div className="relative h-72 overflow-hidden bg-slate-900 cursor-pointer">
                  <Image
                    src={room.image}
                    alt={room.name}
                    fill
                    className="object-cover object-center transition duration-300 hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                  <div className="absolute inset-0 bg-black/30" />
                </div>
              </Link>
              <div className="p-7">
                <div className="mb-4 flex flex-wrap gap-2 text-sm font-bold uppercase">
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    60 Minutes
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    2–10 Players
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1">
                    Live Adventure
                  </span>
                </div>

                <h3 className="mb-3 text-2xl font-black">{room.name}</h3>
                <p className="mb-6 text-slate-600">
                  {room.description}
                </p>

                <div className="flex gap-3">
                  <Link
                    href={room.href}
                    className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-center font-black uppercase"
                  >
                    Learn More
                  </Link>
                  <Link
                    href={room.bookHref}
                    className="flex-1 rounded-full bg-orange-500 px-5 py-3 text-center font-black uppercase text-white"
                  >
                    Book
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Groups CTA */}
      <section className="bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
              Groups & Events
            </p>
            <h2 className="mb-5 text-4xl font-black md:text-5xl">
              Every Great Gathering Deserves an Unforgettable Adventure.
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-300">
              Planning for 20 or more? Contact us and we&apos;ll help you plan the perfect event.
            </p>
            <div className="mt-8 flex justify-center lg:justify-start">
              <Link
                href="/contact"
                className="rounded-full bg-orange-500 px-8 py-4 font-black uppercase text-white"
              >
                Contact Us
              </Link>
            </div>
          </div>

          <div className="relative h-80 overflow-hidden rounded-[32px]">
            <Image
              src="/images/rooms/posing-fun.jpg"
              alt="Friends enjoying an Escape Room Mystery adventure"
              fill
              className="object-cover"
              style={{ objectPosition: "50% 10%" }}
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black md:text-5xl">How It Works</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            ["1", "Choose Your Room", "Pick the adventure that fits your group."],
            ["2", "Book Your Time", "Select a live available time and reserve your spot."],
            ["3", "Escape the Room", "Arrive ready to solve puzzles and beat the clock."],
          ].map(([num, title, text]) => (
            <div
              key={num}
              className="rounded-[28px] border border-slate-200 p-8 text-center shadow-sm"
            >
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-2xl font-black text-white">
                {num}
              </div>
              <h3 className="mb-3 text-2xl font-black">{title}</h3>
              <p className="text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-orange-500 px-6 py-20 text-center text-white">
        <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
          Ready to Book Your Escape?
        </h2>
        <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
          Choose your room and see live availability now.
        </p>
        <Link
          href="/locations/king-of-prussia/book-now"
          className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
        >
          Book Now
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