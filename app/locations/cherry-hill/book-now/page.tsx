"use client";

import Image from "next/image";
import Link from "next/link";

const rooms = [
  {
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
    price: "$37.00",
    times: ["10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM", "6:00 PM", "7:30 PM", "9:00 PM"],
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
    price: "$37.00",
    times: ["11:00 AM", "12:30 PM", "2:00 PM", "3:30 PM", "5:00 PM", "6:30 PM", "8:00 PM"],
  },
  {
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
    price: "$37.00",
    times: ["10:45 AM", "12:15 PM", "1:45 PM", "3:15 PM", "4:45 PM", "6:15 PM", "7:45 PM", "9:15 PM"],
  },
  {
    name: "Laboratory - Heisenberg's Poison",
    image: "/images/rooms/laboratory-homepage-01.jpg",
    price: "$37.00",
    times: ["10:30 AM", "12:00 PM", "1:30 PM", "3:00 PM", "4:30 PM", "6:00 PM", "7:30 PM", "9:00 PM"],
  },
  {
    name: "Witch's Cauldron - Restoration",
    image: "/images/rooms/witchs-cauldron-homepage-01.jpg",
    price: "$37.00",
    times: ["11:15 AM", "12:45 PM", "2:15 PM", "3:45 PM", "5:15 PM", "6:45 PM", "8:15 PM"],
  },
];

export default function CherryHillBookNowPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="bg-slate-100 px-6 py-16 text-center">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Book Now
        </p>
        <h1 className="text-5xl font-black md:text-6xl">
          Cherry Hill
        </h1>
        <p className="mt-4 text-lg font-semibold text-slate-600">
          Select a room and choose an available time.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-center gap-6 text-center">
          <button className="text-2xl font-black">‹</button>
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
              Selected Date
            </p>
            <h2 className="text-2xl font-black underline">
              Saturday, May 30
            </h2>
          </div>
          <button className="text-2xl font-black">›</button>
        </div>

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <article
              key={room.name}
              className="overflow-hidden rounded-[18px] border-2 border-slate-950 bg-white shadow-lg"
            >
              <div className="relative h-56 bg-slate-900">
                <Image
                  src={room.image}
                  alt={room.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-black/25" />
                <div className="absolute bottom-3 left-3 rounded bg-slate-950/90 px-3 py-1 text-sm font-black text-white">
                  {room.price}
                </div>
              </div>

              <div className="border-t-2 border-slate-950 p-5">
                <h3 className="mb-1 text-xl font-black uppercase">
                  {room.name}
                </h3>
                <p className="mb-5 text-sm font-bold text-orange-500">
                  Select a time to continue ↓
                </p>

                <div className="grid grid-cols-3 gap-3">
                  {room.times.map((time) => (
                    <button
                      key={time}
                      className="rounded border-2 border-slate-950 px-2 py-3 text-center text-sm font-black hover:bg-orange-500 hover:text-white"
                    >
                      {time}
                      <span className="block text-[10px] font-bold">
                        available
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/locations/cherry-hill"
            className="inline-block rounded-full border-2 border-slate-950 px-8 py-4 font-black uppercase"
          >
            Back to Cherry Hill Rooms
          </Link>
        </div>
      </section>
    </main>
  );
}