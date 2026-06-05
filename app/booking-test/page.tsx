"use client";

import { useEffect, useMemo, useState } from "react";

type Room = {
  name: string;
  productId: string;
};

type Slot = {
  eventId: string;
  startTime: string;
  endTime: string;
  numSeatsAvailable: number;
};

const rooms: Room[] = [
  {
    name: "Area 51 - Annihilation",
    productId: "4156839XMX719DC101DCB0",
  },
  {
    name: "Egyptian Tomb - Imhotep's Curse",
    productId: "41568WT9M9Y19DC34DB4BA",
  },
  {
    name: "The Billionaire's Den - Inheritance",
    productId: "41568M3UXNP19DC36157FD",
  },
  {
    name: "Revolution Spies - Patriotism",
    productId: "41568NERWMH19DC81A4E97",
  },
];

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatDateValue(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BookingTestPage() {
  const [selectedRoom, setSelectedRoom] = useState(rooms[0]);
  const [selectedDate, setSelectedDate] = useState("2026-06-07");
  const [players, setPlayers] = useState(2);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);

  const dates = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date("2026-06-07T12:00:00");
      date.setDate(date.getDate() + index);

      return {
        label: formatDateLabel(date),
        value: formatDateValue(date),
      };
    });
  }, []);

  useEffect(() => {
    async function loadSlots() {
      setLoading(true);

      const res = await fetch(
        `/api/bookeo/availability?productId=${selectedRoom.productId}&date=${selectedDate}`,
        { cache: "no-store" }
      );

      const data = await res.json();
      setSlots(data.data || []);
      setLoading(false);
    }

    loadSlots();
  }, [selectedRoom, selectedDate]);

  const total = players * 32;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#070b12",
        color: "white",
        padding: "48px 20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <p style={{ color: "#9ca3af", marginBottom: "8px" }}>
          Escape Room Mystery · Live Availability
        </p>

        <h1 style={{ fontSize: "44px", margin: "0 0 12px" }}>
          Book Your Escape Room
        </h1>

        <p style={{ color: "#d1d5db", fontSize: "18px", marginBottom: "32px" }}>
          Choose your room, date, players, and available start time.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.2fr) minmax(320px, 0.8fr)",
            gap: "24px",
          }}
        >
          <section
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "22px",
              padding: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>1. Select Room</h2>

            <div style={{ display: "grid", gap: "12px", marginBottom: "28px" }}>
              {rooms.map((room) => (
                <button
                  key={room.productId}
                  onClick={() => setSelectedRoom(room)}
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    border:
                      selectedRoom.productId === room.productId
                        ? "2px solid #facc15"
                        : "1px solid #374151",
                    background:
                      selectedRoom.productId === room.productId
                        ? "#30270a"
                        : "#1f2937",
                    color: "white",
                    textAlign: "left",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                >
                  {room.name}
                </button>
              ))}
            </div>

            <h2>2. Select Date</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                gap: "10px",
                marginBottom: "28px",
              }}
            >
              {dates.map((date) => (
                <button
                  key={date.value}
                  onClick={() => setSelectedDate(date.value)}
                  style={{
                    padding: "14px",
                    borderRadius: "14px",
                    border:
                      selectedDate === date.value
                        ? "2px solid #facc15"
                        : "1px solid #374151",
                    background:
                      selectedDate === date.value ? "#30270a" : "#1f2937",
                    color: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  {date.label}
                </button>
              ))}
            </div>

            <h2>3. Select Time</h2>

            {loading ? (
              <p style={{ color: "#9ca3af" }}>Loading live availability...</p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "12px",
                }}
              >
                {slots.map((slot) => {
                  const soldOut = slot.numSeatsAvailable < players;

                  return (
                    <button
                      key={slot.eventId}
                      disabled={soldOut}
                      style={{
                        padding: "16px",
                        borderRadius: "14px",
                        border: "1px solid #374151",
                        background: soldOut ? "#111827" : "#1f2937",
                        color: soldOut ? "#6b7280" : "white",
                        cursor: soldOut ? "not-allowed" : "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontSize: "20px", fontWeight: 700 }}>
                        {formatTime(slot.startTime)}
                      </div>
                      <div style={{ fontSize: "14px", marginTop: "6px" }}>
                        {soldOut
                          ? "Unavailable"
                          : `${slot.numSeatsAvailable} seats available`}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              borderRadius: "22px",
              padding: "24px",
              height: "fit-content",
              position: "sticky",
              top: "24px",
            }}
          >
            <h2 style={{ marginTop: 0 }}>Booking Summary</h2>

            <p style={{ color: "#9ca3af", marginBottom: "4px" }}>Room</p>
            <p style={{ fontWeight: 700 }}>{selectedRoom.name}</p>

            <p style={{ color: "#9ca3af", marginBottom: "4px" }}>Date</p>
            <p style={{ fontWeight: 700 }}>{selectedDate}</p>

            <p style={{ color: "#9ca3af", marginBottom: "8px" }}>Players</p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "24px",
              }}
            >
              <button
                onClick={() => setPlayers((value) => Math.max(2, value - 1))}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  border: "1px solid #374151",
                  background: "#1f2937",
                  color: "white",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                -
              </button>

              <strong style={{ fontSize: "24px" }}>{players}</strong>

              <button
                onClick={() => setPlayers((value) => Math.min(10, value + 1))}
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "999px",
                  border: "1px solid #374151",
                  background: "#1f2937",
                  color: "white",
                  fontSize: "20px",
                  cursor: "pointer",
                }}
              >
                +
              </button>
            </div>

            <div
              style={{
                borderTop: "1px solid #374151",
                paddingTop: "18px",
                marginTop: "18px",
              }}
            >
              <p style={{ color: "#9ca3af", marginBottom: "4px" }}>
                Estimated Total
              </p>
              <p style={{ fontSize: "34px", fontWeight: 800, margin: 0 }}>
                ${total}
              </p>
            </div>

            <button
              style={{
                width: "100%",
                marginTop: "24px",
                padding: "16px",
                borderRadius: "14px",
                border: 0,
                background: "#facc15",
                color: "#111827",
                fontSize: "18px",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Continue
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}