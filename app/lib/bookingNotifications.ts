import "server-only";
import { Redis } from "@upstash/redis";
import type { BookingSession } from "./booking";
import { logBookingEvent } from "./bookingLog";
import {
  DAY_KEYS,
  RECIPIENTS,
  getEasternDayKey,
  getEffectiveDays,
  getNotificationSettings,
  isWithinStoreHours,
  type NotificationLocation,
  type NotificationRecipientKey,
} from "./notificationSettings";
import { sendSms } from "./sms";

const redis = Redis.fromEnv();

const SOURCE_TTL_SECONDS =
  60 * 60 * 24 * 7;

const SENT_TTL_SECONDS =
  60 * 60 * 24 * 60;

function sourceKey(checkoutId: string) {
  return `booking-notification-source:${checkoutId}`;
}

function sentKey(
  checkoutId: string,
  recipient: NotificationRecipientKey
) {
  return `booking-notification-sent:${checkoutId}:${recipient}`;
}

export async function rememberBookingNotificationSource(
  session: BookingSession
) {
  if (
    process.env.SMS_NOTIFICATIONS_ENABLED !==
    "true"
  ) {
    return;
  }

  try {
    await redis.set(
      sourceKey(session.checkoutId),
      session,
      { ex: SOURCE_TTL_SECONDS }
    );
  } catch (error) {
    /*
     * Deliberately fail-open. Notification bookkeeping
     * must never interrupt payment or booking work.
     */
    console.error(
      "Could not save booking notification source.",
      {
        checkoutId: session.checkoutId,
        reason:
          error instanceof Error
            ? error.message
            : "unknown",
      }
    );
  }
}

function parseBookingStart(
  dateValue: string,
  timeValue: string
) {
  const dateMatch =
    dateValue.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!dateMatch) {
    return null;
  }

  const time = timeValue.trim();
  let hour = 0;
  let minute = 0;

  const twelve = time.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i
  );
  const twentyFour = time.match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (twelve) {
    hour = Number(twelve[1]);
    minute = Number(twelve[2]);
    const meridiem =
      twelve[3].toUpperCase();

    if (hour < 1 || hour > 12) {
      return null;
    }

    hour %= 12;
    if (meridiem === "PM") {
      hour += 12;
    }
  } else if (twentyFour) {
    hour = Number(twentyFour[1]);
    minute = Number(twentyFour[2]);

    if (hour < 0 || hour > 23) {
      return null;
    }
  } else {
    return null;
  }

  if (minute < 0 || minute > 59) {
    return null;
  }

  const [year, month, day] =
    dateMatch.slice(1).map(Number);

  /*
   * Escape Room Mystery is in Eastern Time. For the
   * notification lead-time test, resolve the event
   * against the Eastern offset applicable on that date.
   */
  const noonUtc = new Date(
    Date.UTC(year, month - 1, day, 12)
  );
  const zone =
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      timeZoneName: "longOffset",
    })
      .formatToParts(noonUtc)
      .find((part) =>
        part.type === "timeZoneName"
      )?.value;

  const offset =
    zone?.replace("GMT", "");

  if (
    !offset ||
    !/^[+-]\d{2}:\d{2}$/.test(offset)
  ) {
    return null;
  }

  const iso =
    `${dateValue}T${String(hour).padStart(
      2,
      "0"
    )}:${String(minute).padStart(
      2,
      "0"
    )}:00${offset}`;

  const parsed = new Date(iso);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
}

function formatDate(dateValue: string) {
  const match =
    dateValue.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return dateValue;
  }

  return `${match[2]}/${match[3]}/${match[1]}`;
}

function locationLabel(
  location: NotificationLocation
) {
  return location === "cherry-hill"
    ? "Cherry Hill"
    : "King of Prussia";
}

function buildMessage(
  session: BookingSession
) {
  const lines = [
    `Location: ${locationLabel(
      session.location as NotificationLocation
    )}`,
    `Date: ${formatDate(session.date)}`,
    `Time: ${session.time}`,
    `Room: ${session.roomName}`,
    `Phone Number: ${session.phone}`,
    `Name: ${`${session.firstName} ${session.lastName}`.trim()}`,
    `Number of Players: ${session.players}`,
  ];

  if (
    session.location === "cherry-hill"
  ) {
    lines.push(
      `Elevator Required: ${session.elevatorAssistanceRequired
        ? "Yes"
        : "No"
      }`
    );
  }

  return lines.join("\n");
}

async function shouldNotify({
  recipient,
  session,
  finalizedAt,
}: {
  recipient: NotificationRecipientKey;
  session: BookingSession;
  finalizedAt: Date;
}) {
  const location =
    session.location as NotificationLocation;

  if (
    location !== "king-of-prussia" &&
    location !== "cherry-hill"
  ) {
    return false;
  }

  const elevatorOverride =
    location === "cherry-hill" &&
    session.elevatorAssistanceRequired === true &&
    (
      recipient === "david" ||
      recipient === "chTracfone"
    );

  if (elevatorOverride) {
    return true;
  }

  const days = await getEffectiveDays(
    recipient,
    location
  );
  const day =
    getEasternDayKey(finalizedAt);

  if (
    !DAY_KEYS.includes(day) ||
    !days.includes(day)
  ) {
    return false;
  }

  const start = parseBookingStart(
    session.date,
    session.time
  );

  if (!start) {
    return false;
  }

  const settings =
    await getNotificationSettings();
  const leadMs =
    settings.leadTimeHours[recipient] *
    60 *
    60 *
    1000;
  const untilGame =
    start.getTime() - finalizedAt.getTime();

  if (
    untilGame < 0 ||
    untilGame > leadMs
  ) {
    return false;
  }

  if (
    recipient === "kopTracfone" ||
    recipient === "chTracfone"
  ) {
    return isWithinStoreHours(finalizedAt);
  }

  return true;
}

export async function triggerCompletedBookingNotifications({
  checkoutId,
  holdId,
}: {
  checkoutId: string;
  holdId?: string | null;
}) {
  /*
   * Absolute safety rule: this function is called only
   * AFTER the ledger is already COMPLETE. Every error is
   * caught here so notification work can never roll back,
   * alter, or fail the completed booking.
   */
  try {
    if (
      process.env.SMS_NOTIFICATIONS_ENABLED !==
      "true"
    ) {
      return;
    }

    let session =
      await redis.get<BookingSession>(
        sourceKey(checkoutId)
      );

    if (!session && holdId) {
      const sessionId =
        await redis.get<string>(
          `booking-session-for-hold:${holdId}`
        );

      if (sessionId) {
        session =
          await redis.get<BookingSession>(
            `booking-session:${sessionId}`
          );
      }
    }

    if (!session) {
      console.error(
        "Completed booking notification source was unavailable.",
        { checkoutId }
      );
      return;
    }

    const finalizedAt = new Date();
    const message = buildMessage(session);

    const recipients =
      Object.keys(RECIPIENTS) as
      NotificationRecipientKey[];

    for (const recipient of recipients) {
      if (
        !(await shouldNotify({
          recipient,
          session,
          finalizedAt,
        }))
      ) {
        continue;
      }

      const claim = await redis.set(
        sentKey(checkoutId, recipient),
        {
          status: "sending",
          claimedAt: Date.now(),
        },
        {
          nx: true,
          ex: SENT_TTL_SECONDS,
        }
      );

      if (claim !== "OK") {
        continue;
      }

      const result = await sendSms({
        to: RECIPIENTS[recipient].phone,
        body: message,
      });

      if (result.ok === false) {
        await redis.del(
          sentKey(checkoutId, recipient)
        );

        console.error(
          "Booking SMS notification failed.",
          {
            checkoutId,
            recipient,
            reason: result.message,
          }
        );
        continue;
      }

      await redis.set(
        sentKey(checkoutId, recipient),
        {
          status: "sent",
          sentAt: Date.now(),
          messageSid: result.messageSid,
        },
        { ex: SENT_TTL_SECONDS }
      );

      logBookingEvent(
        "notification.sent",
        {
          checkoutId,
          metadata: {
            recipient,
            messageSid:
              result.messageSid,
          },
        }
      );
    }
  } catch (error) {
    console.error(
      "Completed booking notification processing failed.",
      {
        checkoutId,
        reason:
          error instanceof Error
            ? error.message
            : "unknown",
      }
    );
  }
}
