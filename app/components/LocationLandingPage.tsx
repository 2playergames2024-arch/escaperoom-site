import Image from "next/image";
import Link from "next/link";

import LocationFooter from "./LocationFooter";
import LocationHeader from "./LocationHeader";
import LocationHeroVideo from "./LocationHeroVideo";

import {
  getLocationBySlug,
  type LocationSlug,
} from "../data/locations";

type Props = {
  locationSlug: LocationSlug;
};

export default function LocationLandingPage({
  locationSlug,
}: Props) {
  const location =
    getLocationBySlug(locationSlug);

  if (!location) {
    throw new Error(
      "Invalid location configuration."
    );
  }

  const rooms =
    Object.values(location.rooms);

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
        bookHref={
          location.bookHref
        }
      />

      <main className="min-h-screen bg-white text-slate-950">
        {/* Hero */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#334155_1px,transparent_1px)] [background-size:36px_36px] opacity-30" />

          <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">
            <div>
              <p className="mb-5 text-2xl font-black uppercase tracking-[0.10em] text-orange-400">
                {location.shortName},{" "}
                {location.state}
              </p>

              <h1 className="max-w-full text-5xl font-black leading-[1.05] tracking-tight md:text-6xl xl:text-7xl">
                Bring your group. We&apos;ll
                handle the fun.
              </h1>
            </div>

            <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <div className="order-1 lg:order-2">
                <div className="rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur">
                  <div className="relative h-[340px] overflow-hidden rounded-[24px] md:h-[380px]">
                    <LocationHeroVideo />

                    <div className="absolute inset-0 bg-black/25" />
                  </div>
                </div>
              </div>

              <div className="order-2 lg:order-1">
                <p className="text-lg font-black uppercase leading-relaxed tracking-[0.03em] text-white md:text-xl">
                  Custom-Built Adventures
                  <span className="mx-2 text-orange-400">
                    •
                  </span>
                  Family Owned
                  <span className="mx-2 text-orange-400">
                    •
                  </span>
                  10 Years Strong
                </p>

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

                <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                  <Link
                    href={
                      location.bookHref
                    }
                    className="flex w-full items-center justify-center whitespace-nowrap rounded-full bg-orange-500 px-8 py-4 text-center text-lg font-black uppercase leading-none text-white hover:bg-orange-600 sm:w-auto lg:w-[210px]"
                  >
                    Book
                  </Link>

                  <a
                    href="#rooms"
                    className="flex w-full items-center justify-center whitespace-nowrap rounded-full border-2 border-white px-8 py-4 text-center text-lg font-black uppercase leading-none text-white hover:bg-white hover:text-slate-950 sm:w-auto lg:w-[210px]"
                  >
                    View Rooms
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Rooms */}
        <section
          id="rooms"
          className="mx-auto max-w-7xl px-6 py-20"
        >
          <div className="mb-12 text-center">
            <p className="mb-3 text-lg font-black uppercase tracking-[0.2em] text-orange-500">
              What will you Conquer?
            </p>

            <h2 className="text-4xl font-black md:text-5xl">
              One-of-a-Kind Adventures
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              Designed by people who love
              escape rooms for people who love
              great adventures.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {rooms.map((room) => {
              const roomBookHref =
                `${location.bookHref}?room=${encodeURIComponent(
                  room.slug
                )}`;

              return (
                <article
                  key={room.name}
                  className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-lg"
                >
                  <Link
                    href={
                      room.detailHref
                    }
                  >
                    <div className="relative h-72 cursor-pointer overflow-hidden bg-slate-900">
                      <Image
                        src={
                          room.image
                        }
                        alt={
                          room.name
                        }
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
                        {room.minPlayers}–
                        {room.maxPlayers} Players
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1">
                        Live Adventure
                      </span>
                    </div>

                    <h3 className="mb-3 text-2xl font-black">
                      {room.name}
                    </h3>

                    <p className="mb-6 text-slate-600">
                      {room.description}
                    </p>

                    <div className="flex gap-3">
                      <Link
                        href={
                          room.detailHref
                        }
                        className="flex-1 rounded-full border border-slate-300 px-5 py-3 text-center font-black uppercase"
                      >
                        Learn More
                      </Link>

                      <Link
                        href={
                          roomBookHref
                        }
                        className="flex-1 rounded-full bg-orange-500 px-5 py-3 text-center font-black uppercase text-white"
                      >
                        Book
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
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
                Every Great Gathering Deserves
                an Unforgettable Adventure.
              </h2>

              <p className="mb-8 text-lg leading-relaxed text-slate-300">
                Planning for 20 or more?
                Contact us and we&apos;ll help
                you plan the perfect event.
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
                style={{
                  objectPosition:
                    "50% 10%",
                }}
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-black md:text-5xl">
              How It Works
            </h2>
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
            ].map(
              ([
                num,
                title,
                text,
              ]) => (
                <div
                  key={num}
                  className="rounded-[28px] border border-slate-200 p-8 text-center shadow-sm"
                >
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500 text-2xl font-black text-white">
                    {num}
                  </div>

                  <h3 className="mb-3 text-2xl font-black">
                    {title}
                  </h3>

                  <p className="text-slate-600">
                    {text}
                  </p>
                </div>
              )
            )}
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-orange-500 px-6 py-20 text-center text-white">
          <h2 className="mx-auto mb-6 max-w-3xl text-4xl font-black md:text-6xl">
            Ready to Book Your Escape?
          </h2>

          <p className="mx-auto mb-8 max-w-2xl text-xl font-semibold">
            Choose your room and see live
            availability now.
          </p>

          <Link
            href={
              location.bookHref
            }
            className="inline-block rounded-full bg-slate-950 px-10 py-5 text-lg font-black uppercase text-white"
          >
            Book Now
          </Link>
        </section>
      </main>

      <LocationFooter
        locationName={
          location.shortName
        }
        streetAddress={
          location.streetAddress
        }
        cityStateZip={
          location.cityStateZip
        }
        phone={
          location.phone
        }
        bookHref={
          location.bookHref
        }
        roomsHref={
          location.roomsHref
        }
      />
    </>
  );
}