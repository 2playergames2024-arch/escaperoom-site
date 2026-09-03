import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  BOOKEO_PEOPLE_CATEGORY_ID,
  LOCATIONS,
  getLocationBySlug,
  getRoomByProductId,
} from "../../../data/locations";
import { isValidCalendarDate } from "../../../lib/booking";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_HOLD_TIMEOUT_MS = 15_000;

type TrustedAvailabilitySlot = {
  eventId: string;
  productId: string;
  startTime: string;
};

function getEasternBookingDateTime(
  startTime: string
) {
  /*
   * Bookeo availability is the server-authoritative
   * source for the event start. Require an explicit
   * timezone so the server locale cannot alter it.
   */
  if (
    !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(
      startTime
    )
  ) {
    throw new Error(
      "Bookeo availability start time has no timezone."
    );
  }

  const instant = new Date(startTime);

  if (
    Number.isNaN(
      instant.getTime()
    )
  ) {
    throw new Error(
      "Bookeo availability start time is invalid."
    );
  }

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }
    ).formatToParts(instant);

  const getPart = (
    type: Intl.DateTimeFormatPartTypes
  ) =>
    parts.find(
      (part) =>
        part.type === type
    )?.value;

  const year = getPart("year");
  const month = getPart("month");
  const day = getPart("day");
  const hour = getPart("hour");
  const minute = getPart("minute");
  const dayPeriod =
    getPart("dayPeriod");

  if (
    !year ||
    !month ||
    !day ||
    !hour ||
    !minute ||
    !dayPeriod
  ) {
    throw new Error(
      "Could not derive trusted booking date/time."
    );
  }

  return {
    date:
      `${year}-${month}-${day}`,
    time:
      `${hour}:${minute} ${dayPeriod}`,
  };
}

function isSaturday(value: string) {
  const [year, month, day] =
    value.split("-").map(Number);

  return (
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    ).getUTCDay() === 6
  );
}

export async function POST(
  request: Request
) {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  const ip =
    forwardedFor
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get(
      "x-real-ip"
    ) ||
    "unknown";

  const rateLimitKey =
    `rate-limit:bookeo-hold:${ip}`;

  const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      180
    );

  if (attempts > 10) {
    return NextResponse.json(
      {
        error:
          "Too many booking attempts. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "180",
        },
      }
    );
  }

  try {
    const body =
      await request.json();

    const location =
      String(
        body.location || ""
      ).trim();

    const productId =
      String(
        body.productId || ""
      ).trim();

    const eventId =
      String(
        body.eventId || ""
      ).trim();

    const date =
      String(
        body.date || ""
      ).trim();

    const players =
      Number(body.players);

    const locationConfig =
      getLocationBySlug(
        location
      );

    if (!locationConfig) {
      return NextResponse.json(
        {
          error:
            "Invalid booking location.",
        },
        { status: 400 }
      );
    }

    const room =
      getRoomByProductId(
        location,
        productId
      );

    if (!room) {
      return NextResponse.json(
        {
          error:
            "Invalid room for the selected location.",
        },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        {
          error:
            "Missing booking event.",
        },
        { status: 400 }
      );
    }

    if (
      !isValidCalendarDate(
        date
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid booking date.",
        },
        { status: 400 }
      );
    }

    /*
     * The browser date is only a cache lookup hint.
     * The selected event itself must match Bookeo data
     * previously fetched server-to-server.
     */
    const trustedSlots =
      await redis.get<TrustedAvailabilitySlot[]>(
        `bookeo-trusted-availability:${locationConfig.slug}:${date}`
      );

    const trustedSlot =
      Array.isArray(trustedSlots)
        ? trustedSlots.find(
          (slot) =>
            slot.eventId ===
            eventId &&
            slot.productId ===
            room.productId
        )
        : undefined;

    if (!trustedSlot) {
      return NextResponse.json(
        {
          error:
            "The selected booking time could not be verified. Please refresh availability and select the time again.",
        },
        { status: 409 }
      );
    }

    const {
      date:
      trustedDate,
      time:
      trustedTime,
    } =
      getEasternBookingDateTime(
        trustedSlot.startTime
      );

    const minimumPlayers =
      isSaturday(trustedDate)
        ? room.saturdayMinPlayers
        : room.minPlayers;

    if (
      !Number.isInteger(
        players
      ) ||
      players <
      minimumPlayers ||
      players >
      room.maxPlayers
    ) {
      return NextResponse.json(
        {
          error:
            `Player count must be between ${minimumPlayers} and ${room.maxPlayers} for this booking.`,
        },
        { status: 400 }
      );
    }

    const BOOKEO_API_KEY =
      locationConfig.slug ===
        LOCATIONS.cherryHill.slug
        ? BOOKEO_CH_API_KEY
        : BOOKEO_KOP_API_KEY;

    if (
      !BOOKEO_API_KEY ||
      !BOOKEO_SECRET_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Missing Bookeo credentials for this location.",
        },
        { status: 500 }
      );
    }

    const response =
      await fetch(
        "https://api.bookeo.com/v2/holds",
        {
          method: "POST",
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              BOOKEO_HOLD_TIMEOUT_MS
            ),
          headers: {
            "Content-Type":
              "application/json",
            "X-Bookeo-apiKey":
              BOOKEO_API_KEY,
            "X-Bookeo-secretKey":
              BOOKEO_SECRET_KEY,
          },
          body:
            JSON.stringify({
              eventId,
              productId:
                room.productId,

              participants: {
                numbers: [
                  {
                    peopleCategoryId:
                      BOOKEO_PEOPLE_CATEGORY_ID,
                    number:
                      players,
                  },
                ],
              },

              promotionCodeInput:
                body.promoCode ||
                undefined,
            }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      const serialized =
        JSON.stringify(
          data
        ).toLowerCase();

      const message =
        serialized.includes(
          "voucher"
        ) ||
          serialized.includes(
            "promotion"
          ) ||
          serialized.includes(
            "coupon"
          )
          ? "Gift voucher or promo code not found."
          : data.message ||
          data.error ||
          "Could not create booking hold.";

      console.error(
        "Bookeo hold request rejected.",
        {
          location,
          productId:
            room.productId,
          status:
            response.status,
        }
      );

      return NextResponse.json(
        { message },
        {
          status:
            response.status,
        }
      );
    }

    const holdId =
      String(
        data.id || ""
      );

    const holdExpiration =
      String(
        data.expiration || ""
      );

    const holdCreatedAt =
      Date.now();

    console.info(
      "BOOKING_TIMELINE",
      {
        stage:
          "bookeo_hold_created",

        holdId,

        location:
          locationConfig.slug,

        productId:
          room.productId,

        eventId,

        occurredAt:
          new Date(
            holdCreatedAt
          ).toISOString(),

        holdExpiration,

        holdDurationMs:
          Number.isFinite(
            new Date(
              holdExpiration
            ).getTime()
          )
            ? new Date(
              holdExpiration
            ).getTime() -
            holdCreatedAt
            : null,
      }
    );

    const roomCharge =
      Number(
        data.price
          ?.totalNet?.amount
      );

    const promotionDiscount =
      Number(
        data
          .appliedPromotionDiscount
          ?.amount ?? 0
      );

    const tax =
      Number(
        data.price
          ?.totalTaxes?.amount
      );

    const trustedTotal =
      Number(
        data.totalPayable
          ?.amount
      );

    if (
      !holdId ||
      !holdExpiration ||
      !Number.isFinite(
        roomCharge
      ) ||
      roomCharge < 0 ||
      !Number.isFinite(
        promotionDiscount
      ) ||
      promotionDiscount <
      0 ||
      !Number.isFinite(
        tax
      ) ||
      tax < 0 ||
      !Number.isFinite(
        trustedTotal
      ) ||
      trustedTotal <= 0
    ) {
      console.error(
        "Bookeo hold returned an invalid price breakdown.",
        {
          location,
          productId:
            room.productId,
        }
      );

      return NextResponse.json(
        {
          error:
            "Bookeo returned an invalid booking price.",
        },
        { status: 500 }
      );
    }

    await redis.set(
      `bookeo-hold:${holdId}`,
      {
        holdId,

        location:
          locationConfig.slug,

        productId:
          room.productId,

        eventId,

        roomSlug:
          room.slug,

        roomName:
          room.name,

        image:
          room.image,

        players:
          String(players),

        date:
          trustedDate,
        time:
          trustedTime,

        roomCharge:
          roomCharge.toFixed(
            2
          ),

        promotionDiscount:
          promotionDiscount.toFixed(
            2
          ),

        tax:
          tax.toFixed(2),

        total:
          trustedTotal.toFixed(
            2
          ),

        holdExpiration,

        createdAt:
          Date.now(),
      },
      {
        ex: 60 * 60,
      }
    );

    return NextResponse.json(
      {
        status:
          response.status,
        data,
      },
      {
        status:
          response.status,
      }
    );
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (
        error.name ===
        "TimeoutError" ||
        error.name ===
        "AbortError"
      );

    console.error(
      "Bookeo hold request failed.",
      {
        reason:
          isTimeout
            ? "timeout"
            : "request_error",
      }
    );

    return NextResponse.json(
      {
        error:
          isTimeout
            ? "Bookeo took too long to respond. Please try again."
            : "Could not create booking hold.",
      },
      {
        status:
          isTimeout
            ? 504
            : 500,
      }
    );
  }
}