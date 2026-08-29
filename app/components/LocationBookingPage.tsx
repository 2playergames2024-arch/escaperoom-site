"use client";

import {
  type LocationSlug,
  getLocationBySlug,
} from "../data/locations";
import LocationHeader from "./LocationHeader";
import LocationFooter from "./LocationFooter";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  trackClarityEvent,
} from "../lib/clarity";

type ResumeBooking = {
  sessionId: string;
  location: string;
  roomName: string;
  date: string;
  time: string;
};

type Slot = {
  eventId: string;
  productId: string;
  startTime: string;
  endTime: string;
  numSeatsAvailable: number;
};

type BookingRoom = {
  slug: string;
  name: string;
  image: string;
  basePrice: number;
  displayPrice: string;
  productId: string;
  minPlayers: number;
  saturdayMinPlayers: number;
  maxPlayers: number;
};

type AvailabilityStatus =
  | "loading"
  | "loaded"
  | "error";

type Props = {
  locationSlug: LocationSlug;
};

function formatDateForApi(date: Date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");
  const day = String(
    date.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(dateString: string) {
  return new Date(
    dateString
  ).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function LocationBookingPage({
  locationSlug,
}: Props) {
  const locationData =
    getLocationBySlug(locationSlug);

  if (!locationData) {
    throw new Error(
      "Invalid booking location."
    );
  }

  const rooms = useMemo(
    () =>
      Object.values(
        locationData.rooms
      ) as BookingRoom[],
    [locationData]
  );

  const dateInputRef =
    useRef<HTMLInputElement>(null);

  const latestRequestRef =
    useRef(0);


  const [selectedDate, setSelectedDate] =
    useState(new Date());

  const [
    selectedRoomSlug,
    setSelectedRoomSlug,
  ] = useState<string | null>(
    null
  );

  const [
    slotsByRoom,
    setSlotsByRoom,
  ] = useState<
    Record<string, Slot[]>
  >({});

  const [
    availabilityStatus,
    setAvailabilityStatus,
  ] = useState<
    Record<
      string,
      AvailabilityStatus
    >
  >({});

  const [
    isAvailabilityFetching,
    setIsAvailabilityFetching,
  ] = useState(false);

  const [resumeBooking, setResumeBooking] =
    useState<ResumeBooking | null>(null);

  /*
   * Restore optional room/date from URL.
   */
  useEffect(() => {
    const restoreTimer =
      window.setTimeout(() => {
        const searchParams =
          new URLSearchParams(
            window.location.search
          );

        const roomFromUrl =
          searchParams.get("room");

        const dateFromUrl =
          searchParams.get("date");

        const validRoom =
          rooms.some(
            (room) =>
              room.slug ===
              roomFromUrl
          );

        if (
          roomFromUrl &&
          validRoom
        ) {
          setSelectedRoomSlug(
            roomFromUrl
          );
        }

        if (dateFromUrl) {
          const restoredDate =
            new Date(
              `${dateFromUrl}T12:00:00`
            );

          if (
            !Number.isNaN(
              restoredDate.getTime()
            )
          ) {
            const today =
              new Date();

            today.setHours(
              12,
              0,
              0,
              0
            );

            restoredDate.setHours(
              12,
              0,
              0,
              0
            );

            if (
              restoredDate >=
              today
            ) {
              setSelectedDate(
                restoredDate
              );
            }
          }
        }
      }, 0);

    return () => {
      window.clearTimeout(
        restoreTimer
      );
    };
  }, [rooms]);

  const displayedRooms =
    useMemo(() => {
      if (!selectedRoomSlug) {
        return rooms;
      }

      const selectedRoom =
        rooms.find(
          (room) =>
            room.slug ===
            selectedRoomSlug
        );

      if (!selectedRoom) {
        return rooms;
      }

      return [
        selectedRoom,
        ...rooms.filter(
          (room) =>
            room.slug !==
            selectedRoomSlug
        ),
      ];
    }, [
      rooms,
      selectedRoomSlug,
    ]);

  const today = new Date();

  today.setHours(
    12,
    0,
    0,
    0
  );

  const selectedDay =
    new Date(selectedDate);

  selectedDay.setHours(
    12,
    0,
    0,
    0
  );

  const isToday =
    formatDateForApi(
      selectedDay
    ) ===
    formatDateForApi(today);

  function clearAvailability() {
    setSlotsByRoom({});
    setAvailabilityStatus({});
  }

  function changeDate(
    days: number
  ) {
    setSelectedDate(
      (
        currentDate
      ) => {
        const nextDate =
          new Date(
            currentDate
          );

        nextDate.setDate(
          nextDate.getDate() +
          days
        );

        nextDate.setHours(
          12,
          0,
          0,
          0
        );

        if (
          nextDate < today
        ) {
          return currentDate;
        }

        clearAvailability();

        trackClarityEvent(
          "booking_date_selected"
        );
        return nextDate;
      }
    );
  }

  function selectDateFromCalendar(
    dateString: string
  ) {
    if (!dateString) {
      return;
    }

    const pickedDate =
      new Date(
        `${dateString}T12:00:00`
      );

    if (
      Number.isNaN(
        pickedDate.getTime()
      ) ||
      pickedDate < today
    ) {
      return;
    }

    clearAvailability();

    trackClarityEvent(
      "booking_date_selected"
    );

    setSelectedDate(
      pickedDate
    );
  }

  useEffect(() => {
    let cancelled = false;

    async function loadResumeBooking() {
      try {
        const response =
          await fetch(
            "/api/booking-resume",
            {
              cache: "no-store",
            }
          );

        const data =
          await response.json();

        if (
          !cancelled &&
          response.ok &&
          data.active &&
          data.booking?.location ===
          locationSlug
        ) {
          setResumeBooking(
            data.booking
          );
        }
      } catch {
        // Resume lookup is optional.
        // Normal booking flow should still work.
      }
    }

    loadResumeBooking();

    return () => {
      cancelled = true;
    };
  }, [locationSlug]);

  /*
 * Load all room availability with one
 * Bookeo request for the selected date.
 */
  useEffect(() => {
    const requestId =
      latestRequestRef.current +
      1;

    latestRequestRef.current =
      requestId;

    const controller =
      new AbortController();

    const signal =
      controller.signal;

    const debounceTimer =
      window.setTimeout(
        async () => {
          if (
            signal.aborted ||
            requestId !==
            latestRequestRef.current
          ) {
            return;
          }

          setIsAvailabilityFetching(true);

          setSlotsByRoom({});

          setAvailabilityStatus(
            Object.fromEntries(
              rooms.map(
                (room) => [
                  room.productId,
                  "loading" as const,
                ]
              )
            )
          );

          try {
            const date =
              formatDateForApi(
                selectedDate
              );

            const response =
              await fetch(
                `/api/bookeo/availability?date=${encodeURIComponent(
                  date
                )}&location=${encodeURIComponent(
                  locationSlug
                )}`,
                {
                  cache:
                    "no-store",
                  signal,
                }
              );

            const data =
              await response
                .json()
                .catch(
                  () => null
                );

            if (
              signal.aborted ||
              requestId !==
              latestRequestRef.current
            ) {
              return;
            }

            if (!response.ok) {
              setAvailabilityStatus(
                Object.fromEntries(
                  rooms.map(
                    (room) => [
                      room.productId,
                      "error" as const,
                    ]
                  )
                )
              );

              return;
            }

            const groupedSlots =
              data?.data &&
                typeof data.data ===
                "object"
                ? data.data as Record<
                  string,
                  Slot[]
                >
                : {};

            setSlotsByRoom(
              Object.fromEntries(
                rooms.map(
                  (room) => [
                    room.productId,
                    Array.isArray(
                      groupedSlots[
                      room.productId
                      ]
                    )
                      ? groupedSlots[
                      room.productId
                      ]
                      : [],
                  ]
                )
              )
            );

            setAvailabilityStatus(
              Object.fromEntries(
                rooms.map(
                  (room) => [
                    room.productId,
                    "loaded" as const,
                  ]
                )
              )
            );
          } catch {
            if (
              signal.aborted
            ) {
              return;
            }

            setAvailabilityStatus(
              Object.fromEntries(
                rooms.map(
                  (room) => [
                    room.productId,
                    "error" as const,
                  ]
                )
              )
            );
          } finally {
            if (
              !signal.aborted &&
              requestId ===
              latestRequestRef.current
            ) {
              setIsAvailabilityFetching(
                false
              );
            }
          }
        },
        500
      );

    return () => {
      window.clearTimeout(
        debounceTimer
      );

      controller.abort();
    };
  }, [
    selectedDate,
    rooms,
    locationSlug,
  ]);

  const formattedDate =
    selectedDate.toLocaleDateString(
      "en-US",
      {
        weekday:
          "long",
        month:
          "long",
        day:
          "numeric",
      }
    );

  const dateInputValue =
    formatDateForApi(
      selectedDate
    );

  const todayInputValue =
    formatDateForApi(
      today
    );

  const selectedRoom =
    rooms.find(
      (room) =>
        room.slug ===
        selectedRoomSlug
    );

  return (
    <>
      <LocationHeader
        locationName={`${locationData.shortName}, ${locationData.state}`}
        locationSubtitle={
          locationData.subtitle
        }
        homeHref={
          locationData.homeHref
        }
        roomsHref={
          locationData.roomsHref
        }
        bookHref={
          locationData.bookHref
        }
      />

      <main className="min-h-screen bg-white text-slate-950">
        <section className="bg-slate-100 px-6 py-6 text-center">
          <p className="mb-4 text-2xl font-black uppercase tracking-[0.22em] text-orange-500">
            Book Now
          </p>

          <h1 className="text-5xl font-black md:text-6xl">
            {
              locationData.shortName
            }
          </h1>

        </section>

        <section className="mx-auto max-w-7xl px-6 py-3">
          {resumeBooking && (
            <div className="mx-auto mb-6 max-w-xl rounded-2xl border-[6px] border-orange-500 bg-orange-50 p-6 text-center">
              <p className="text-2xl font-black uppercase tracking-wide text-orange-600">
                Booking in Progress
              </p>

              <p className="mt-2 font-bold text-slate-700">
                {resumeBooking.roomName}
                {" — "}
                {new Date(
                  `${resumeBooking.date}T12:00:00`
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
                {" at "}
                {resumeBooking.time}
              </p>

              <Link
                href={`/book/payment?sessionId=${encodeURIComponent(
                  resumeBooking.sessionId
                )}`}
                className="mt-3 inline-block rounded bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
              >
                Continue Booking
              </Link>

              <p className="mt-2 text-sm font-bold text-slate-600">
                Or select a new room and time below.
              </p>
            </div>
          )}
          <div className="sticky top-[76px] z-30 mx-auto mb-8 grid w-full max-w-xl grid-cols-[52px_minmax(0,1fr)_52px] items-center bg-white py-2 text-center shadow-sm">
            <button
              type="button"
              onClick={() =>
                changeDate(-1)
              }
              disabled={
                isToday ||
                isAvailabilityFetching
              }
              aria-label="Previous day"
              className="flex h-12 w-12 items-center justify-center rounded-lg text-5xl font-black leading-none hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
            >
              ‹
            </button>

            <div className="min-w-0 px-2 text-center">
              <p className="text-lg font-black uppercase tracking-[0.14em] text-orange-500 sm:text-xl sm:tracking-[0.18em]">
                Selected Date
              </p>

              <div className="mt-1 flex h-12 items-center justify-center px-1">
                <p className="text-xl font-black leading-tight sm:text-2xl">
                  {
                    formattedDate
                  }
                </p>
              </div>

              <button
                type="button"
                disabled={
                  isAvailabilityFetching
                }
                onClick={() =>
                  dateInputRef.current?.showPicker()
                }
                aria-label="Choose a date from the calendar"
                className="mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-2xl leading-none hover:bg-slate-100"
              >
                📅
              </button>

              <input
                ref={
                  dateInputRef
                }
                type="date"
                disabled={isAvailabilityFetching}
                aria-label="Select booking date"
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

            <button
              type="button"
              disabled={isAvailabilityFetching}
              onClick={() =>
                changeDate(1)
              }
              aria-label="Next day"
              className="flex h-12 w-12 items-center justify-center rounded-lg text-5xl font-black leading-none hover:bg-slate-100"
            >
              ›
            </button>
          </div>

          {selectedRoom && (
            <div className="mb-8 rounded-2xl border-2 border-orange-500 bg-orange-50 px-6 py-5 text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-orange-500">
                Your Selected Room
              </p>

              <p className="mt-2 text-xl font-black text-slate-950">
                {
                  selectedRoom.name
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
              (room) => {
                const slots =
                  slotsByRoom[
                  room.productId
                  ] || [];

                const status =
                  availabilityStatus[
                  room.productId
                  ] ??
                  "loading";

                const isSelectedRoom =
                  room.slug ===
                  selectedRoomSlug;

                return (
                  <article
                    key={
                      room.productId
                    }
                    className={`relative overflow-hidden rounded-[18px] bg-white shadow-lg ${isSelectedRoom
                      ? "border-4 border-orange-500"
                      : "border-2 border-slate-950"
                      }`}
                  >
                    {isSelectedRoom && (
                      <div className="absolute left-4 top-4 z-20 rounded-full bg-orange-500 px-4 py-2 text-xs font-black uppercase tracking-[0.10em] text-white shadow-lg">
                        Your Selected
                        Room
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
                          room.displayPrice
                        }
                      </div>
                    </div>

                    <div className="min-h-[400px] border-t-2 border-slate-950 p-5">
                      <h3 className="mb-1 text-xl font-black uppercase md:min-h-[56px]">
                        {
                          room.name
                        }
                      </h3>

                      <p className="mb-5 text-sm font-bold text-orange-500">
                        Select a time
                        to continue ↓
                      </p>

                      {status ===
                        "loading" ? (
                        <p className="rounded border-2 border-orange-300 bg-orange-50 px-3 py-4 text-center text-sm font-black text-orange-600">
                          Checking
                          availability...
                        </p>
                      ) : status ===
                        "error" ? (
                        <p
                          role="status"
                          className="rounded border-2 border-red-300 bg-red-50 px-3 py-4 text-center text-sm font-black text-red-700"
                        >
                          Temporarily
                          unavailable.
                          Please try
                          another date
                          or refresh.
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
                            ) => {
                              const isFull =
                                slot.numSeatsAvailable <=
                                0;

                              return (
                                <button
                                  type="button"
                                  key={
                                    slot.eventId
                                  }
                                  disabled={
                                    isFull
                                  }
                                  aria-label={
                                    isFull
                                      ? `${room.name} at ${formatTime(slot.startTime)} is full`
                                      : `${room.name} at ${formatTime(slot.startTime)}, ${slot.numSeatsAvailable} seats available`
                                  }
                                  onClick={() => {
                                    if (
                                      isFull
                                    ) {
                                      return;
                                    }

                                    trackClarityEvent(
                                      "booking_time_selected"
                                    );

                                    window.location.href =
                                      `/book/details` +
                                      `?location=${encodeURIComponent(
                                        locationSlug
                                      )}` +
                                      `&productId=${encodeURIComponent(
                                        room.productId
                                      )}` +
                                      `&eventId=${encodeURIComponent(
                                        slot.eventId
                                      )}` +
                                      `&date=${encodeURIComponent(
                                        dateInputValue
                                      )}` +
                                      `&time=${encodeURIComponent(
                                        formatTime(
                                          slot.startTime
                                        )
                                      )}` +
                                      `&seats=${encodeURIComponent(
                                        String(
                                          slot.numSeatsAvailable
                                        )
                                      )}`;
                                  }}
                                  className={
                                    isFull
                                      ? "cursor-not-allowed rounded border-2 border-slate-300 bg-slate-200 px-2 py-3 text-center text-sm font-black text-slate-500"
                                      : "rounded border-2 border-slate-950 px-2 py-3 text-center text-sm font-black hover:bg-orange-500 hover:text-white"
                                  }
                                >
                                  <span
                                    className={
                                      isFull
                                        ? "text-[9px] font-bold"
                                        : "text-sm font-black"
                                    }
                                  >
                                    {formatTime(
                                      slot.startTime
                                    )}
                                  </span>

                                  <span
                                    className={
                                      isFull
                                        ? "block text-[9px] font-semibold"
                                        : "block text-[10px] font-bold"
                                    }
                                  >
                                    {isFull
                                      ? "FULL"
                                      : `${slot.numSeatsAvailable} available`}
                                  </span>
                                </button>
                              );
                            }
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
              href={
                locationData.homeHref
              }
              className="inline-block rounded-full border-2 border-slate-950 px-8 py-4 font-black uppercase"
            >
              Back to{" "}
              {
                locationData.shortName
              }{" "}
              Rooms
            </Link>
          </div>
        </section>
      </main>

      <LocationFooter
        locationName={
          locationData.shortName
        }
        streetAddress={
          locationData.streetAddress
        }
        cityStateZip={
          locationData.cityStateZip
        }
        phone={
          locationData.phone
        }
        bookHref={
          locationData.bookHref
        }
        roomsHref={
          locationData.roomsHref
        }
      />
    </>
  );
}