"use client";

import LocationFooter from "@/app/components/LocationFooter";
import LocationHeader from "@/app/components/LocationHeader";
import Link from "next/link";
import Image from "next/image";

const rooms = [
  {
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
    href: "/locations/cherry-hill/rooms/area-51-annihilation",
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
    href: "/locations/cherry-hill/rooms/egyptian-tomb-imhoteps-curse",
  },
  {
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
    href: "/locations/cherry-hill/rooms/billionaires-den-inheritance",
  },
  {
    name: "Laboratory - Heisenberg's Poison",
    image: "/images/rooms/laboratory-homepage-01.jpg",
    href: "/locations/cherry-hill/rooms/laboratory-heisenbergs-poison",
  },
  {
    name: "Witch's Cauldron - Restoration",
    image: "/images/rooms/witchs-cauldron-homepage-01.jpg",
    href: "/locations/cherry-hill/rooms/witchs-cauldron-restoration",
  },
];

export default function CherryHillPage() {
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
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] [background-size:36px_36px] opacity-30" />

        <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-6 py-20 lg:grid-cols-2">
          <div>
            <p className="mb-4 text-sm font-black uppercase tracking-[0.25em] text-orange-400">
              Cherry Hill, NJ
            </p>

            <h1 className="mb-6 text-5xl font-black leading-tight tracking-tight md:text-7xl">
              The Ultimate Escape Room Adventure
            </h1>

            <p className="mb-8 max-w-xl text-xl leading-relaxed text-slate-300">
              Choose your room, gather your team, and race the clock in a fully
              immersive 60-minute experience.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link
                href="/locations/cherry-hill/book-now"
                className="rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-orange-600"
              >
                Book Now
              </Link>

              <a
                href="#rooms"
                className="rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase text-white hover:bg-white hover:text-slate-950"
              >
                View Rooms
              </a>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
            <div className="relative h-[360px] overflow-hidden rounded-[24px]">
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
                <source src="/videos/hero.mp4" type="video/mp4" />
              </video>

              <div className="absolute inset-0 bg-black/35" />
            </div>
          </div>
        </div>
      </section>

      {/* Rooms */}
      <section id="rooms" className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
            Choose Your Game
          </p>
          <h2 className="text-4xl font-black md:text-5xl">
            Immersive Escape Rooms
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            Each room has its own story, puzzles, surprises, and
            race-against-the-clock mission.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {rooms.map((room) => (
            <article
              key={room.name}
              className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg"
            >
              <Link href={room.href}>
                <div className="relative h-72 cursor-pointer overflow-hidden bg-slate-900">
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
                  Work together, find clues, solve puzzles, and complete your
                  mission before time runs out.
                </p>

                <div className="flex gap-3">
                  <Link
                    href={room.href}
                    className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-center font-black uppercase"
                  >
                    Learn More
                  </Link>
                  <Link
                    href="/locations/cherry-hill/book-now"
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
              Perfect for Parties, Teams, and Special Events
            </h2>
            <p className="mb-8 text-lg leading-relaxed text-slate-300">
              Bring your group together for an unforgettable challenge. Great
              for birthdays, corporate team building, youth groups, and family
              nights.
            </p>
            <Link
              href="/events"
              className="rounded-full bg-orange-500 px-8 py-4 font-black uppercase text-white"
            >
              Plan Your Event
            </Link>
          </div>

          <div className="h-80 rounded-[32px] bg-slate-800" />
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-4xl font-black md:text-5xl">How It Works</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {[
            [
              "1",
              "Choose Your Room",
              "Pick the adventure that fits your group.",
            ],
            [
              "2",
              "Book Your Time",
              "Select a live available time and reserve your spot.",
            ],
            [
              "3",
              "Escape the Room",
              "Arrive ready to solve puzzles and beat the clock.",
            ],
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
          href="/locations/cherry-hill/book-now"
          className="flex-1 rounded-full bg-orange-500 px-5 py-3 text-center font-black uppercase text-white"
        >
          Book
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