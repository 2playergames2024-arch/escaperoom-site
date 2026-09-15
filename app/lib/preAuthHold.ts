import "server-only";
import { Redis } from "@upstash/redis";
import {
  BOOKEO_PEOPLE_CATEGORY_ID,
  LOCATIONS,
} from "@/app/data/locations";
import {
  type BookingSession,
  type TrustedBookeoHold,
  getEasternDayBounds,
} from "@/app/lib/booking";
import {
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;

const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;

const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_TIMEOUT_MS = 15_000;

type AvailabilitySlot = {
  eventId: string;
  productId: string;
  numSeatsAvailable: number;
};

type PreAuthHoldResult =
  | {
      ok: true;
      replaced: boolean;
      session: BookingSession;
    }
  | {
      ok: false;
      reason:
        | "UNAVAILABLE"
        | "BOOKEO_ERROR";
      retryable: boolean;
    };

function getBookeoApiKey(
  location: string
) {
  return location ===
    LOCATIONS.cherryHill.slug
    ? BOOKEO_CH_API_KEY
    : BOOKEO_KOP_API_KEY;
}

export async function ensurePreAuthHold(
  session: BookingSession
): Promise<PreAuthHoldResult> {
  const BOOKEO_API_KEY =
    getBookeoApiKey(
      session.location
    );

  if (
    !BOOKEO_API_KEY ||
    !BOOKEO_SECRET_KEY
  ) {
    throw new Error(
      "Bookeo credentials are not configured."
    );
  }

  const bookeoHeaders = {
    "Content-Type":
      "application/json",
    "X-Bookeo-apiKey":
      BOOKEO_API_KEY,
    "X-Bookeo-secretKey":
      BOOKEO_SECRET_KEY,
  };

  /*
   * First determine whether the current
   * hold is still usable.
   */
  const expirationTime =
    new Date(
      session.holdExpiration
    ).getTime();

  let holdIsValid = false;

  if (
    Number.isFinite(
      expirationTime
    ) &&
    Date.now() <
      expirationTime
  ) {
    const holdResponse =
      await fetch(
        `https://api.bookeo.com/v2/holds/${encodeURIComponent(
          session.holdId
        )}`,
        {
          method: "GET",
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
            ),
          headers:
            bookeoHeaders,
        }
      );

    if (holdResponse.ok) {
      holdIsValid = true;
    } else if (
      holdResponse.status === 404 ||
      holdResponse.status === 410 ||
      holdResponse.status === 400
    ) {
      holdIsValid = false;
    } else {
      return {
        ok: false,
        reason:
          "BOOKEO_ERROR",
        retryable: true,
      };
    }
  }

  if (holdIsValid) {
    await updateBookingLedgerRecord({
      checkoutId:
        session.checkoutId,
      holdId:
        session.holdId,
    });

    return {
      ok: true,
      replaced: false,
      session,
    };
  }

  /*
   * The old hold is gone or expired.
   * Check whether the exact same Bookeo
   * event still has enough seats.
   */
  const {
    startTime,
    endTime,
  } =
    getEasternDayBounds(
      session.date
    );

  const availabilityUrl =
    `https://api.bookeo.com/v2/availability/slots` +
    `?productId=${encodeURIComponent(
      session.productId
    )}` +
    `&startTime=${encodeURIComponent(
      startTime
    )}` +
    `&endTime=${encodeURIComponent(
      endTime
    )}` +
    `&itemsPerPage=300`;

  const availabilityResponse =
    await fetch(
      availabilityUrl,
      {
        method: "GET",
        cache: "no-store",
        signal:
          AbortSignal.timeout(
            BOOKEO_TIMEOUT_MS
          ),
        headers:
          bookeoHeaders,
      }
    );

  if (!availabilityResponse.ok) {
    return {
      ok: false,
      reason:
        "BOOKEO_ERROR",
      retryable: true,
    };
  }

  const availabilityData =
    await availabilityResponse.json();

  const slots =
    Array.isArray(
      availabilityData?.data
    )
      ? availabilityData.data as
          AvailabilitySlot[]
      : [];

  const requiredPlayers =
    Number(
      session.players
    );

  const matchingSlot =
    slots.find(
      (slot) =>
        slot.eventId ===
          session.eventId &&
        slot.productId ===
          session.productId &&
        Number(
          slot.numSeatsAvailable
        ) >= requiredPlayers
    );

  if (!matchingSlot) {
    return {
      ok: false,
      reason:
        "UNAVAILABLE",
      retryable: false,
    };
  }

  /*
   * The same slot is available.
   * Create a fresh hold.
   *
   * Do not send the expired hold as
   * previousHoldId.
   */
  const replacementResponse =
    await fetch(
      "https://api.bookeo.com/v2/holds?holdDurationSeconds=600",
      {
        method: "POST",
        cache: "no-store",
        signal:
          AbortSignal.timeout(
            BOOKEO_TIMEOUT_MS
          ),
        headers:
          bookeoHeaders,
        body:
          JSON.stringify({
            eventId:
              session.eventId,

            productId:
              session.productId,

            participants: {
              numbers: [
                {
                  peopleCategoryId:
                    BOOKEO_PEOPLE_CATEGORY_ID,
                  number:
                    requiredPlayers,
                },
              ],
            },

            promotionCodeInput:
              session.promoCode ||
              undefined,
          }),
      }
    );

  if (
    !replacementResponse.ok
  ) {
    return {
      ok: false,
      reason:
        replacementResponse.status >=
          500 ||
        replacementResponse.status ===
          429
          ? "BOOKEO_ERROR"
          : "UNAVAILABLE",
      retryable:
        replacementResponse.status >=
          500 ||
        replacementResponse.status ===
          429,
    };
  }

  const replacementData =
    await replacementResponse.json();

  const newHoldId =
    String(
      replacementData.id || ""
    );

  const newHoldExpiration =
    String(
      replacementData.expiration ||
      ""
    );

  const roomCharge =
    Number(
      replacementData.price
        ?.totalNet?.amount
    );

  const promotionDiscount =
    Number(
      replacementData
        .appliedPromotionDiscount
        ?.amount ?? 0
    );

  const tax =
    Number(
      replacementData.price
        ?.totalTaxes?.amount
    );

  const total =
    Number(
      replacementData.totalPayable
        ?.amount
    );

  if (
    !newHoldId ||
    !newHoldExpiration ||
    !Number.isFinite(
      roomCharge
    ) ||
    !Number.isFinite(
      promotionDiscount
    ) ||
    !Number.isFinite(tax) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return {
      ok: false,
      reason:
        "BOOKEO_ERROR",
      retryable: true,
    };
  }

  const updatedSession:
    BookingSession = {
      ...session,

      holdId:
        newHoldId,

      holdExpiration:
        newHoldExpiration,

      roomCharge:
        roomCharge.toFixed(2),

      promotionDiscount:
        promotionDiscount.toFixed(
          2
        ),

      tax:
        tax.toFixed(2),

      total:
        total.toFixed(2),
    };

  const trustedHold:
    TrustedBookeoHold = {
      holdId:
        newHoldId,

      checkoutId:
        session.checkoutId,

      promoCode:
        session.promoCode,

      productId:
        session.productId,

      eventId:
        session.eventId,

      players:
        session.players,

      location:
        session.location,

      roomSlug:
        session.roomSlug,

      roomName:
        session.roomName,

      image:
        session.image,

      date:
        session.date,

      time:
        session.time,

      roomCharge:
        updatedSession.roomCharge,

      promotionDiscount:
        updatedSession
          .promotionDiscount,

      tax:
        updatedSession.tax,

      total:
        updatedSession.total,

      holdExpiration:
        newHoldExpiration,

      createdAt:
        Date.now(),
    };

  /*
   * Publish the replacement hold/session
   * before removing the old Redis keys.
   */
  await redis.set(
    `bookeo-hold:${newHoldId}`,
    trustedHold,
    {
      ex: 60 * 60,
    }
  );

  await redis.set(
    `booking-session:${session.sessionId}`,
    updatedSession,
    {
      ex: 60 * 60,
    }
  );

  await redis.set(
    `booking-session-for-hold:${newHoldId}`,
    session.sessionId,
    {
      ex: 60 * 60,
    }
  );

  await updateBookingLedgerRecord({
    checkoutId:
      session.checkoutId,

    holdId:
      newHoldId,
  });

  await redis.del(
    `bookeo-hold:${session.holdId}`
  );

  await redis.del(
    `booking-session-for-hold:${session.holdId}`
  );

  return {
    ok: true,
    replaced: true,
    session:
      updatedSession,
  };
}