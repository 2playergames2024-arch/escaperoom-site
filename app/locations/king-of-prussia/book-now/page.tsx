"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Slot = {
  eventId: string;
  productId: string;
  startTime: string;
  endTime: string;
  numSeatsAvailable: number;
};

const rooms = [
  {
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
    price: "$37.00",
    productId: "4156839XMX719DC101DCB0",
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
    price: "$37.00",
    productId: "41568WT9M9Y19DC34DB4BA",
  },
  {
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
    price: "$37.00",
    productId: "41568M3UXNP19DC36157FD",
  },
  {
    name: "Revolution Spies - Patriotism",
    image: "/images/rooms/revolution-spies-homepage-01.jpg",
    price: "$37.00",
    productId: "41568NERWMH19DC81A4E97",
  },
];

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function KingOfPrussiaBookNowPage() {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slotsByRoom, setSlotsByRoom] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(false);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const selectedDay = new Date(selectedDate);
  selectedDay.setHours(12, 0, 0, 0);

  const isToday = formatDateForApi(selectedDay) === formatDateForApi(today);

  function changeDate(days: number) {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(nextDate.getDate() + days);
    nextDate.setHours(12, 0, 0, 0);

    if (nextDate < today) return;

    setSelectedDate(nextDate);
  }

  function selectDateFromCalendar(dateString: string) {
    const pickedDate = new Date(`${dateString}T12:00:00`);
    setSelectedDate(pickedDate);
  }

  useEffect(() => {
    async function loadAvailability() {
      setLoading(true);

      const date = formatDateForApi(selectedDate);
      const results: Record<string, Slot[]> = {};

      await Promise.all(
        rooms.map(async (room) => {
          const res = await fetch(
            `/api/bookeo/availability?productId=${room.productId}&date=${date}`,
            { cache: "no-store" }
          );

          const data = await res.json();

          console.log("Bookeo result", {
            room: room.name,
            date,
            status: res.status,
            data,
          });

          results[room.productId] = data.data || [];
        })
      );

      setSlotsByRoom(results);
      setLoading(false);
    }

    loadAvailability();
  }, [selectedDate]);

  const formattedDate = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const dateInputValue = formatDateForApi(selectedDate);
  const todayInputValue = formatDateForApi(today);

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <section className="bg-slate-100 px-6 py-16 text-center">
        <p className="mb-3 text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Book Now
        </p>
        <h1 className="text-5xl font-black md:text-6xl">King of Prussia</h1>
        <p className="mt-4 text-lg font-semibold text-slate-600">
          Select a room and choose an available time.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex items-center justify-center gap-6 text-center">
          <button
            onClick={() => changeDate(-1)}
            disabled={isToday}
            className="text-2xl font-black disabled:cursor-not-allowed disabled:opacity-30"
          >
            ‹
          </button>

          <div className="w-80 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
              Selected Date
            </p>

            <button
              type="button"
              onClick={() => dateInputRef.current?.showPicker()}
              className="text-2xl font-black underline"
            >
              {formattedDate} 📅
            </button>

            <input
              ref={dateInputRef}
              type="date"
              value={dateInputValue}
              min={todayInputValue}
              onChange={(e) => selectDateFromCalendar(e.target.value)}
              className="sr-only"
            />
          </div>

          <button onClick={() => changeDate(1)} className="text-2xl font-black">
            ›
          </button>
        </div>

        {loading && (
          <p className="mb-6 text-center text-sm font-black uppercase tracking-[0.2em] text-orange-500">
            Loading live availability...
          </p>
        )}

        <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => {
            const slots = slotsByRoom[room.productId] || [];

            return (
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

                  {slots.length === 0 ? (
                    <p className="rounded border-2 border-slate-300 px-3 py-4 text-center text-sm font-black text-slate-500">
                      No times available
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 gap-3">
                      {slots.map((slot) => (
                        <button
                          key={slot.eventId}
                          onClick={() =>
                              window.location.href =
                                `/book/details` +
                                `?room=${encodeURIComponent(room.name)}` +
                                `&image=${encodeURIComponent(room.image)}` +
                                `&price=${encodeURIComponent(room.price)}` +
                                `&productId=${room.productId}` +
                                `&eventId=${slot.eventId}` +
                                `&date=${dateInputValue}` +
                                `&time=${encodeURIComponent(formatTime(slot.startTime))}` +
                                `&seats=${slot.numSeatsAvailable}`
                            }
                          className="rounded border-2 border-slate-950 px-2 py-3 text-center text-sm font-black hover:bg-orange-500 hover:text-white"
                        >
                          {formatTime(slot.startTime)}
                          <span className="block text-[10px] font-bold">
                            {slot.numSeatsAvailable} available
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/locations/king-of-prussia"
            className="inline-block rounded-full border-2 border-slate-950 px-8 py-4 font-black uppercase"
          >
            Back to King of Prussia Rooms
          </Link>
        </div>
      </section>
    </main>
  );
}