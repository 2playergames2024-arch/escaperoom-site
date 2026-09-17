import "server-only";

import {
  BOOKEO_PEOPLE_CATEGORY_ID,
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

export type FinalBookeoBookingResult =
  | {
      ok: true;
      bookingId: string;
    }
  | {
      ok: false;
      reason: "REJECTED";
      status: number;
      message: string;
      data: unknown;
    }
  | {
      ok: false;
      reason: "UNCERTAIN";
      message: string;
      data?: unknown;
    };

function getBookeoApiKey(
  location: string
) {
  return location ===
    LOCATIONS.cherryHill.slug
    ? BOOKEO_CH_API_KEY
    : BOOKEO_KOP_API_KEY;
}

export async function createFinalBookeoBooking(
  session: BookingSession,
  authorizeTransactionId: string
): Promise<FinalBookeoBookingResult> {
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
      reason: "UNCERTAIN",
      message:
        "Bookeo credentials are not configured.",
    };
  }

  const players =
    Number(session.players);

  if (
    !Number.isInteger(players) ||
    players <= 0
  ) {
    return {
      ok: false,
      reason: "UNCERTAIN",
      message:
        "The trusted participant count is invalid.",
    };
  }

  const url =
    `https://api.bookeo.com/v2/bookings` +
    `?previousHoldId=${encodeURIComponent(
      session.holdId
    )}` +
    `&notifyUsers=false` +
    `&notifyCustomer=false`;

  try {
    const response =
      await fetch(
        url,
        {
          method: "POST",
          cache: "no-store",

          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
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
              productId:
                session.productId,

              eventId:
                session.eventId,

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

              customer: {
                firstName:
                  session.firstName ||
                  "",

                lastName:
                  session.lastName ||
                  "",

                emailAddress:
                  session.email ||
                  "",

                phoneNumbers:
                  session.phone
                    ? [
                        {
                          number:
                            session.phone,

                          type:
                            "mobile",
                        },
                      ]
                    : [],
              },

              notes: [
                {
                  text:
                    `Authorize.Net authorization ${authorizeTransactionId}`,
                },
              ],
            }),
        }
      );

    let data: any = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    /*
     * A 4xx response is an explicit Bookeo
     * rejection. It is safe to treat this as
     * "booking not created."
     */
    if (
      response.status >= 400 &&
      response.status < 500
    ) {
      return {
        ok: false,
        reason: "REJECTED",
        status:
          response.status,
        message:
          typeof data?.message ===
          "string"
            ? data.message
            : "Bookeo rejected the booking.",
        data,
      };
    }

    /*
     * 5xx is ambiguous. Bookeo may have
     * accepted the CREATE before the response
     * failed, so do not issue another CREATE.
     */
    if (!response.ok) {
      return {
        ok: false,
        reason: "UNCERTAIN",
        message:
          "Bookeo did not return a confirmed booking result.",
        data,
      };
    }

    const bookingNumber =
      String(
        data?.bookingNumber ||
        ""
      ).trim();

    /*
     * A successful HTTP response without a
     * booking number is also ambiguous.
     */
    if (!bookingNumber) {
      return {
        ok: false,
        reason: "UNCERTAIN",
        message:
          "Bookeo returned success but no booking number was present.",
        data,
      };
    }

    return {
      ok: true,
      bookingId:
        bookingNumber,
    };
  } catch (error) {
    return {
      ok: false,
      reason: "UNCERTAIN",
      message:
        error instanceof Error
          ? error.message
          : "Bookeo booking creation returned an uncertain result.",
    };
  }
}