import "server-only";

import {
  LOCATIONS,
} from "@/app/data/locations";

import {
  type BookingSession,
  getEasternDayBounds,
} from "@/app/lib/booking";

import {
  fetchAllBookeoBookingPages,
} from "@/app/lib/bookeoBookingsPagination";

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_TIMEOUT_MS = 15_000;

type BookeoBooking = {
  bookingNumber?: string;
  externalRef?: string;
  productId?: string;
  eventId?: string;
  canceled?: boolean;
};

export type BookeoBookingLookupResult =
  | {
    ok: true;
    result: "FOUND";
    bookingId: string;
  }
  | {
    ok: true;
    result: "NO_MATCH";
  }
  | {
    ok: true;
    result: "AMBIGUOUS";
    matches: number;
  }
  | {
    ok: false;
    result: "ERROR";
    message: string;
  };

function getBookeoApiKey(
  location: string
) {
  return location ===
    LOCATIONS.cherryHill.slug
    ? BOOKEO_CH_API_KEY
    : BOOKEO_KOP_API_KEY;
}

export async function lookupFinalBookeoBooking(
  session: BookingSession
): Promise<BookeoBookingLookupResult> {
  const BOOKEO_API_KEY =
    getBookeoApiKey(
      session.location
    );

  if (
    !BOOKEO_API_KEY ||
    !BOOKEO_SECRET_KEY
  ) {
    return {
      ok: false,
      result: "ERROR",
      message:
        "Bookeo credentials are not configured.",
    };
  }

  try {
    const {
      startTime,
      endTime,
    } =
      getEasternDayBounds(
        session.date
      );

    const url =
      `https://api.bookeo.com/v2/bookings` +
      `?startTime=${encodeURIComponent(
        startTime
      )}` +
      `&endTime=${encodeURIComponent(
        endTime
      )}` +
      `&productId=${encodeURIComponent(
        session.productId
      )}` +
      `&includeCanceled=false`;

    const bookingPages =
      await fetchAllBookeoBookingPages<BookeoBooking>(
        url,
        BOOKEO_API_KEY,
        BOOKEO_SECRET_KEY,
        BOOKEO_TIMEOUT_MS
      );

    if (!bookingPages.ok) {
      return {
        ok: false,
        result: "ERROR",
        message:
          `Bookeo lookup failed with status ${bookingPages.status}.`,
      };
    }

    const matches =
      bookingPages.bookings.filter(
        (booking) =>
          booking.productId ===
          session.productId &&
          booking.eventId ===
          session.eventId &&
          booking.canceled !== true &&
          booking.externalRef ===
          session.checkoutId
      );

    if (matches.length === 0) {
      return {
        ok: true,
        result: "NO_MATCH",
      };
    }

    if (matches.length > 1) {
      return {
        ok: true,
        result: "AMBIGUOUS",
        matches:
          matches.length,
      };
    }

    const bookingId =
      String(
        matches[0].bookingNumber ||
        ""
      ).trim();

    if (!bookingId) {
      return {
        ok: false,
        result: "ERROR",
        message:
          "Matched Bookeo booking has no booking number.",
      };
    }

    return {
      ok: true,
      result: "FOUND",
      bookingId,
    };
  } catch (error) {
    return {
      ok: false,
      result: "ERROR",
      message:
        error instanceof Error
          ? error.message
          : "Bookeo lookup failed.",
    };
  }
}