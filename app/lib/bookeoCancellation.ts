import "server-only";

import {
  LOCATIONS,
} from "@/app/data/locations";
import {
  type BookingSession,
} from "@/app/lib/booking";

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_TIMEOUT_MS = 15_000;

function getBookeoApiKey(
  location: string
) {
  return location ===
    LOCATIONS.cherryHill.slug
    ? BOOKEO_CH_API_KEY
    : BOOKEO_KOP_API_KEY;
}

function getHeaders(
  session: BookingSession
) {
  const apiKey =
    getBookeoApiKey(
      session.location
    );

  if (
    !apiKey ||
    !BOOKEO_SECRET_KEY
  ) {
    return null;
  }

  return {
    "X-Bookeo-apiKey": apiKey,
    "X-Bookeo-secretKey":
      BOOKEO_SECRET_KEY,
  };
}

export type BookeoCleanupResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      uncertain: boolean;
      message: string;
    };

export async function cancelBookeoBooking({
  session,
  bookingId,
}: {
  session: BookingSession;
  bookingId: string;
}): Promise<BookeoCleanupResult> {
  const headers =
    getHeaders(session);

  if (!headers) {
    return {
      ok: false,
      uncertain: false,
      message:
        "Bookeo credentials are not configured.",
    };
  }

  const query =
    new URLSearchParams({
      notifyUsers: "false",
      notifyCustomer: "false",
      applyCancellationPolicy:
        "false",
      trackInCustomerHistory:
        "false",
      cancelRemainingSeries:
        "false",
      reason:
        "Website checkout could not be completed.",
    });

  try {
    const response =
      await fetch(
        `https://api.bookeo.com/v2/bookings/${encodeURIComponent(
          bookingId
        )}?${query.toString()}`,
        {
          method: "DELETE",
          cache: "no-store",
          headers,
          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
            ),
        }
      );

    if (response.status === 204) {
      return {
        ok: true,
      };
    }

    /*
     * Bookeo retains canceled bookings. If the DELETE
     * response itself was unclear, verify the current
     * booking directly before deciding cleanup failed.
     */
    const verifyResponse =
      await fetch(
        `https://api.bookeo.com/v2/bookings/${encodeURIComponent(
          bookingId
        )}`,
        {
          method: "GET",
          cache: "no-store",
          headers,
          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
            ),
        }
      );

    if (verifyResponse.ok) {
      const booking =
        await verifyResponse.json();

      if (
        booking?.canceled === true
      ) {
        return {
          ok: true,
        };
      }
    }

    return {
      ok: false,
      uncertain:
        response.status >= 500,
      message:
        `Bookeo did not confirm booking cancellation (status ${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      uncertain: true,
      message:
        error instanceof Error
          ? error.message
          : "Bookeo booking cancellation could not be confirmed.",
    };
  }
}

export async function deleteBookeoHold({
  session,
  holdId,
}: {
  session: BookingSession;
  holdId: string;
}): Promise<BookeoCleanupResult> {
  if (!holdId) {
    return {
      ok: true,
    };
  }

  const headers =
    getHeaders(session);

  if (!headers) {
    return {
      ok: false,
      uncertain: false,
      message:
        "Bookeo credentials are not configured.",
    };
  }

  try {
    const response =
      await fetch(
        `https://api.bookeo.com/v2/holds/${encodeURIComponent(
          holdId
        )}`,
        {
          method: "DELETE",
          cache: "no-store",
          headers,
          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
            ),
        }
      );

    /*
     * 204 = deleted. 404 = the hold is already gone
     * (consumed, replaced, or expired), which is also
     * a safe cleanup result.
     */
    if (
      response.status === 204 ||
      response.status === 404
    ) {
      return {
        ok: true,
      };
    }

    return {
      ok: false,
      uncertain:
        response.status >= 500,
      message:
        `Bookeo did not confirm hold deletion (status ${response.status}).`,
    };
  } catch (error) {
    return {
      ok: false,
      uncertain: true,
      message:
        error instanceof Error
          ? error.message
          : "Bookeo hold deletion could not be confirmed.",
    };
  }
}
