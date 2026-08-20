import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  LOCATIONS,
  getLocationBySlug,
} from "../../../data/locations";
import {
  getEasternDayBounds,
  getTodayEastern,
  isValidCalendarDate,
} from "../../../lib/booking";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_AVAILABILITY_TIMEOUT_MS = 15_000;
const BOOKEO_ITEMS_PER_PAGE = 300;
const TRUSTED_AVAILABILITY_TTL_SECONDS =
  60 * 60;

type BookeoSlot = {
  eventId: string;
  productId: string;
  startTime: string;
  endTime: string;
  numSeatsAvailable: number;
};

type BookeoAvailabilityResponse = {
  data?: BookeoSlot[];
  info?: {
    totalItems?: number;
    totalPages?: number;
    currentPage?: number;
    pageNavigationToken?: string;
  };
  [key: string]: unknown;
};

export async function GET(
  request: Request
) {
  try {
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
      `rate-limit:bookeo-availability:${ip}`;

    const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      600
    );

    if (attempts > 100) {
      return NextResponse.json(
        {
          error:
            "Too many availability requests. Please wait a few minutes and try again.",
          retryAfter: 600,
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

    const { searchParams } =
      new URL(request.url);

    const location =
      searchParams.get(
        "location"
      ) || "";

    const date =
      searchParams.get(
        "date"
      ) || "";

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

    const todayEastern =
      getTodayEastern();

    if (
      date < todayEastern
    ) {
      return NextResponse.json(
        {
          error:
            "Booking date cannot be in the past.",
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
            "Bookeo is not configured for this location.",
        },
        { status: 500 }
      );
    }

    const {
      startTime,
      endTime,
    } =
      getEasternDayBounds(
        date
      );

    const trustedProductIds =
      new Set(
        Object.values(
          locationConfig.rooms
        ).map(
          (room) =>
            room.productId
        )
      );

    const url =
      `https://api.bookeo.com/v2/availability/slots` +
      `?startTime=${encodeURIComponent(
        startTime
      )}` +
      `&endTime=${encodeURIComponent(
        endTime
      )}` +
      `&itemsPerPage=${BOOKEO_ITEMS_PER_PAGE}`;

    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              BOOKEO_AVAILABILITY_TIMEOUT_MS
            ),
          headers: {
            "X-Bookeo-apiKey":
              BOOKEO_API_KEY,
            "X-Bookeo-secretKey":
              BOOKEO_SECRET_KEY,
          },
        }
      );

    const data =
      await response.json() as BookeoAvailabilityResponse;

    if (!response.ok) {
      console.error(
        "Bookeo availability request failed.",
        {
          location,
          status:
            response.status,
        }
      );

      const retryAfter =
        response.headers.get(
          "retry-after"
        );

      return NextResponse.json(
        data,
        {
          status:
            response.status,
          headers:
            retryAfter
              ? {
                  "Retry-After":
                    retryAfter,
                }
              : undefined,
        }
      );
    }

    const totalPages =
      Number(
        data?.info?.totalPages ?? 1
      );

    if (
      Number.isFinite(totalPages) &&
      totalPages > 1
    ) {
      console.error(
        "Bookeo availability response was paginated beyond the configured single-request limit.",
        {
          location,
          date,
          totalPages,
        }
      );

      return NextResponse.json(
        {
          error:
            "Booking availability could not be completely verified. Please try again.",
        },
        { status: 502 }
      );
    }

    const slots =
      Array.isArray(
        data?.data
      )
        ? data.data.filter(
            (slot) =>
              trustedProductIds.has(
                slot.productId
              )
          )
        : [];

    /*
     * Cache the Bookeo-returned event identity and start
     * time. The hold route uses this server-trusted data
     * instead of trusting browser-supplied date/time.
     */
    await redis.set(
      `bookeo-trusted-availability:${locationConfig.slug}:${date}`,
      slots.map(
        (slot) => ({
          eventId:
            slot.eventId,
          productId:
            slot.productId,
          startTime:
            slot.startTime,
        })
      ),
      {
        ex:
          TRUSTED_AVAILABILITY_TTL_SECONDS,
      }
    );

    const slotsByProductId =
      Object.fromEntries(
        Object.values(
          locationConfig.rooms
        ).map(
          (room) => [
            room.productId,
            slots.filter(
              (slot) =>
                slot.productId ===
                room.productId
            ),
          ]
        )
      );

    return NextResponse.json({
      data:
        slotsByProductId,
      info:
        data.info ?? null,
    });
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
      "Bookeo availability request failed.",
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
            ? "Bookeo took too long to return availability. Please try again."
            : "Could not retrieve booking availability.",
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