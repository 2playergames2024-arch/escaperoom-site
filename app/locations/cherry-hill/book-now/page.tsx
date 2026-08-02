"use client";

import LocationHeader from "../../../components/LocationHeader";
import LocationFooter from "../../../components/LocationFooter";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Slot = {
  eventId: string;
  productId: string;
  startTime: string;
  endTime: string;
  numSeatsAvailable: number;
};

type Room = {
  slug: string;
  name: string;
  image: string;
  price: string;
  productId: string | null;
};

const rooms: Room[] = [
  {
    slug: "area-51",
    name: "Area 51 - Annihilation",
    image: "/images/rooms/area51-homepage-01.jpg",
    price: "$35.00/ea",
    productId: "4156839XMX719DC101DCB0",
  },
  {
    slug: "egyptian-tomb",
    name: "Egyptian Tomb - Imhotep's Curse",
    image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
    price: "$35.00/ea",
    productId: "41568WT9M9Y19DC34DB4BA",
  },
  {
    slug: "billionaires-den",
    name: "The Billionaire's Den - Inheritance",
    image: "/images/rooms/billionaires-den-homepage-01.jpg",
    price: "$35.00/ea",
    productId: "41568M3UXNP19DC36157FD",
  },
  {
    slug: "laboratory",
    name: "Laboratory - Heisenberg's Poison",
    image: "/images/rooms/laboratory-homepage-01.jpg",
    price: "$35.00/ea",
    productId: null,
  },
  {
    slug: "witchs-cauldron",
    name: "Witch's Cauldron - Restoration",
    image: "/images/rooms/witchs-cauldron-homepage-01.jpg",
    price: "$35.00",
    productId: null,
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

export default function CherryHillBookNowPage() {
  const dateInputRef = useRef<HTMLInputElement>(null);
  const latestRequestRef = useRef(0);

  const [selectedDate, setSelectedDate] = useState(new Date());

  const [selectedRoomSlug, setSelectedRoomSlug] = useState<
    string | null
  >(null);

  const [slotsByRoom, setSlotsByRoom] = useState<
    Record<string, Slot[]>
  >({});

  const [loading, setLoading] = useState(true);

  /*
    Read the optional room from the URL.

    Example:
    /book-now?room=revolution-spies
  */
  useEffect(() => {
    const searchParams = new URLSearchParams(
      window.location.search
    );

    const roomFromUrl = searchParams.get("room");
    const dateFromUrl = searchParams.get("date");

    const validRoom = rooms.some(
      (room) => room.slug === roomFromUrl
    );

    if (roomFromUrl && validRoom) {
      setSelectedRoomSlug(roomFromUrl);
    }

    if (dateFromUrl) {
      const restoredDate = new Date(
        `${dateFromUrl}T12:00:00`
      );

      if (!Number.isNaN(restoredDate.getTime())) {
        setSelectedDate(restoredDate);
      }
    }
  }, []);

  /*
    If a specific room was selected, move it to the beginning.

    If the customer entered through the general Book Now button,
    preserve the normal room order.
  */
  const displayedRooms = useMemo(() => {
    if (!selectedRoomSlug) {
      return rooms;
    }

    const selectedRoom = rooms.find(
      (room) => room.slug === selectedRoomSlug
    );

    if (!selectedRoom) {
      return rooms;
    }

    return [
      selectedRoom,
      ...rooms.filter(
        (room) => room.slug !== selectedRoomSlug
      ),
    ];
  }, [selectedRoomSlug]);

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const selectedDay = new Date(selectedDate);
  selectedDay.setHours(12, 0, 0, 0);

  const isToday =
    formatDateForApi(selectedDay) ===
    formatDateForApi(today);

  function changeDate(days: number) {
    setSelectedDate((currentDate) => {
      const nextDate = new Date(currentDate);

      nextDate.setDate(
        nextDate.getDate() + days
      );

      nextDate.setHours(12, 0, 0, 0);

      if (nextDate < today) {
        return currentDate;
      }

      return nextDate;
    });
  }

  function selectDateFromCalendar(
    dateString: string
  ) {
    if (!dateString) return;

    const pickedDate = new Date(
      `${dateString}T12:00:00`
    );

    setSelectedDate(pickedDate);
  }

  useEffect(() => {
    const requestId =
      latestRequestRef.current + 1;

    latestRequestRef.current = requestId;

    let cancelled = false;

    setLoading(true);
    setSlotsByRoom({});

    function wait(milliseconds: number) {
      return new Promise<void>((resolve) => {
        window.setTimeout(
          resolve,
          milliseconds
        );
      });
    }

    async function requestAvailability() {
      const date =
        formatDateForApi(selectedDate);

      const results: Record<
        string,
        Slot[]
      > = {};

      await Promise.all(
        rooms.map(async (room) => {
          if (!room.productId) {
            return;
          }

          const response = await fetch(
            `/api/bookeo/availability?productId=${room.productId}&date=${date}`,
            {
              cache: "no-store",
            }
          );

          if (!response.ok) {
            throw new Error(
              `Bookeo availability failed with status ${response.status}`
            );
          }

          const data =
            await response.json();

          console.log(
            "Bookeo result",
            {
              room: room.name,
              date,
              status: response.status,
              data,
            }
          );

          results[room.productId] =
            data.data || [];
        })
      );

      return results;
    }

    const debounceTimer =
      window.setTimeout(
        async () => {
          let failedAttempts = 0;

          while (
            !cancelled &&
            requestId ===
              latestRequestRef.current
          ) {
            try {
              const results =
                await requestAvailability();

              if (
                cancelled ||
                requestId !==
                  latestRequestRef.current
              ) {
                return;
              }

              setSlotsByRoom(
                results
              );

              setLoading(false);

              return;
            } catch (error) {
              if (
                cancelled ||
                requestId !==
                  latestRequestRef.current
              ) {
                return;
              }

              failedAttempts += 1;

              console.warn(
                `Bookeo availability attempt ${failedAttempts} failed. Retrying silently...`,
                error
              );

              const retryDelay =
                failedAttempts === 1
                  ? 1000
                  : failedAttempts === 2
                    ? 2000
                    : 3000;

              await wait(
                retryDelay
              );
            }
          }
        },
        1000
      );

    return () => {
      cancelled = true;

      window.clearTimeout(
        debounceTimer
      );
    };
  }, [selectedDate]);

  const formattedDate =
    selectedDate.toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        month: "long",
        day: "numeric",
      }
    );

  const dateInputValue =
    formatDateForApi(selectedDate);

  const todayInputValue =
    formatDateForApi(today);

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

        {/* PAGE HEADING */}
        <section className="bg-slate-100 px-6 py-16 text-center">
          <p className="mb-4 text-2xl font-black uppercase tracking-[0.22em] text-orange-500">
            Book Now
          </p>

          <h1 className="text-5xl font-black md:text-6xl">
            Cherry Hill
          </h1>

          <p className="mt-4 text-lg font-semibold text-slate-600">
            Select a room and choose an
            available time.
          </p>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-8">

          {/* DATE SELECTOR */}
          <div className="mb-8 flex items-center justify-center text-center">

            {/* PREVIOUS DAY */}
            <button
              type="button"
              onClick={() =>
                changeDate(-1)
              }
              disabled={isToday}
              aria-label="Previous day"
              className="flex h-14 w-14 shrink-0 items-center justify-center text-4xl font-black disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>

            {/* FIXED DATE AREA */}
            <div
              className="flex shrink-0 flex-col items-center justify-start text-center"
              style={{
                width: "390px",
                minWidth: "390px",
                height: "106px",
              }}
            >
              <p className="text-xl font-black uppercase tracking-[0.18em] text-orange-500">
                Selected Date
              </p>

              <p
                className="mt-1 text-2xl font-black"
                style={{
                  whiteSpace:
                    "nowrap",
                }}
              >
                {formattedDate}
              </p>

              <button
                type="button"
                onClick={() =>
                  dateInputRef.current?.showPicker()
                }
                aria-label="Choose a date from the calendar"
                className="mt-1 flex h-8 w-10 items-center justify-center text-xl"
              >
                📅
              </button>

              <input
                ref={dateInputRef}
                type="date"
                value={
                  dateInputValue
                }
                min={
                  todayInputValue
                }
                onChange={(
                  event
                ) =>
                  selectDateFromCalendar(
                    event.target
                      .value
                  )
                }
                className="sr-only"
              />
            </div>

            {/* NEXT DAY */}
            <button
              type="button"
              onClick={() =>
                changeDate(1)
              }
              aria-label="Next day"
              className="flex h-14 w-14 shrink-0 items-center justify-center text-4xl font-black"
            >
              ›
            </button>
          </div>

          {loading && (
            <p className="mb-6 text-center text-sm font-black uppercase tracking-[0.2em] text-orange-500">
              Loading live
              availability...
            </p>
          )}

          {/* SELECTED ROOM MESSAGE */}
          {selectedRoomSlug && (
            <div className="mb-8 rounded-2xl border-2 border-orange-500 bg-orange-50 px-6 py-5 text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-500">
                Your Selected Room
              </p>

              <p className="mt-2 text-xl font-black text-slate-950">
                {
                  rooms.find(
                    (room) =>
                      room.slug ===
                      selectedRoomSlug
                  )?.name
                }
              </p>

              <p className="mt-1 font-semibold text-slate-600">
                Choose an available
                time below.
              </p>
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
            {displayedRooms.map(
              (room, index) => {
                const slots =
                  room.productId
                    ? slotsByRoom[room.productId] || []
                    : [];

                const isSelectedRoom =
                  room.slug ===
                  selectedRoomSlug;

                return (
                  <article
                    key={
                      room.name
                    }
                    className={`relative overflow-hidden rounded-[18px] bg-white shadow-lg ${
                      isSelectedRoom
                        ? "border-4 border-orange-500"
                        : "border-2 border-slate-950"
                    }`}
                  >

                    {/* SELECTED ROOM BADGE */}
                    {isSelectedRoom && (
                      <div className="absolute left-4 top-4 z-20 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.10em] text-white shadow-lg">
                        Your Selected Room
                      </div>
                    )}

                    <div className="relative h-56 bg-slate-900">
                      <Image
                        src={
                          room.image
                        }
                        alt={
                          room.name
                        }
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />

                      <div className="absolute inset-0 bg-black/25" />

                      <div className="absolute bottom-3 left-3 rounded bg-slate-950/90 px-3 py-1 text-sm font-black text-white">
                        {
                          room.price
                        }
                      </div>
                    </div>

                    <div className="border-t-2 border-slate-950 p-5">
                      <h3 className="mb-1 text-xl font-black uppercase">
                        {
                          room.name
                        }
                      </h3>

                      <p className="mb-5 text-sm font-bold text-orange-500">
                        Select a time
                        to continue ↓
                      </p>

                      {!room.productId ? (
                        <p className="rounded border-2 border-slate-300 px-3 py-4 text-center text-sm font-black text-slate-500">
                          Not available in the sandbox
                        </p>
                      ) : loading ? (
                        <p className="rounded border-2 border-orange-300 bg-orange-50 px-3 py-4 text-center text-sm font-black text-orange-600">
                          Checking
                          availability...
                        </p>
                      ) : slots.length ===
                        0 ? (
                        <p className="rounded border-2 border-slate-300 px-3 py-4 text-center text-sm font-black text-slate-500">
                          No times
                          available
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-3">
                          {slots.map(
                            (
                              slot
                            ) => (
                              <button
                                type="button"
                                key={
                                  slot.eventId
                                }
                                onClick={() => {
                                  window.location.href =
                                    `/book/details` +
                                    `?location=cherry-hill` +
                                    `&room=${encodeURIComponent(room.name)}` +
                                    `&image=${encodeURIComponent(
                                      room.image
                                    )}` +
                                    `&price=${encodeURIComponent(
                                      room.price
                                    )}` +
                                    `&productId=${room.productId}` +
                                    `&eventId=${slot.eventId}` +
                                    `&date=${dateInputValue}` +
                                    `&time=${encodeURIComponent(
                                      formatTime(
                                        slot.startTime
                                      )
                                    )}` +
                                    `&seats=${slot.numSeatsAvailable}`;
                                }}
                                className="rounded border-2 border-slate-950 px-2 py-3 text-center text-sm font-black hover:bg-orange-500 hover:text-white"
                              >
                                {formatTime(
                                  slot.startTime
                                )}

                                <span className="block text-[10px] font-bold">
                                  {
                                    slot.numSeatsAvailable
                                  }{" "}
                                  available
                                </span>
                              </button>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              }
            )}
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