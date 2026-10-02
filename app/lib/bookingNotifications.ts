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
  return `booking-notification-sent:${checkoutId}:${recipient}:normal`;
}

function elevatorSentKey(checkoutId: string) {
  return `booking-notification-sent:${checkoutId}:chTracfone:elevator`;
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
    ? "CH"
    : "KoP";
}

function shortRoomName(roomName: string) {
  return roomName
    .split(" - ")[0]
    .trim();
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
    `Room: ${shortRoomName(session.roomName)}`,
    `Phone: ${session.phone}`,
    `Name: ${`${session.firstName} ${session.lastName}`.trim()}`,
    `# Players: ${session.players}`,
  ];

  if (
    session.location === "cherry-hill"
  ) {
    lines.push(
      `Elevator: ${session.elevatorAssistanceRequired
        ? "Yes"
        : "No"
      }`
    );
  }

  return lines.join("\n");
}

async function evaluateNotification({
  recipient,
  session,
  finalizedAt,
}: {
  recipient: NotificationRecipientKey;
  session: BookingSession;
  finalizedAt: Date;
}): Promise<{
  send: boolean;
  reason: string;
}> {
  const location =
    session.location as NotificationLocation;

  if (
    location !== "king-of-prussia" &&
    location !== "cherry-hill"
  ) {
    return {
      send: false,
      reason: "invalid location",
    };
  }

  if (
    recipient === "kopTracfone" &&
    location === "cherry-hill"
  ) {
    return {
      send: false,
      reason: "Cherry Hill booking",
    };
  }

  if (
    recipient === "chTracfone" &&
    location === "king-of-prussia"
  ) {
    return {
      send: false,
      reason: "King of Prussia booking",
    };
  }

  const start = parseBookingStart(
    session.date,
    session.time
  );

  if (!start) {
    return {
      send: false,
      reason: "booking date/time could not be parsed",
    };
  }

  const untilGame =
    start.getTime() -
    finalizedAt.getTime();

  if (untilGame < 0) {
    return {
      send: false,
      reason: "game time has already passed",
    };
  }

  /*
   * Cherry Hill elevator bookings have a special rule:
   *
   * - The dedicated elevator text is handled separately and
   *   always goes to the Cherry Hill Tracfone.
   * - If the game is within 24 hours, the normal booking text
   *   also goes to David and the Cherry Hill Tracfone.
   * - If the game is more than 24 hours away, no normal booking
   *   text is sent for the elevator booking.
   *
   * This special path intentionally bypasses the normal day and
   * store-hours checks for David and the Cherry Hill Tracfone.
   */
  if (
    location === "cherry-hill" &&
    session.elevatorAssistanceRequired === true
  ) {
    const elevatorNormalWindowMs =
      24 * 60 * 60 * 1000;

    if (
      recipient !== "david" &&
      recipient !== "chTracfone"
    ) {
      return {
        send: false,
        reason: "Cherry Hill elevator booking",
      };
    }

    if (untilGame > elevatorNormalWindowMs) {
      const hoursAway =
        untilGame / 60 / 60 / 1000;

      return {
        send: false,
        reason:
          `elevator booking is ${hoursAway.toFixed(1)} hours away; normal alert starts at 24 hours`,
      };
    }

    return {
      send: true,
      reason: "Cherry Hill elevator booking within 24 hours",
    };
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
    return {
      send: false,
      reason: `day ${day} is not enabled`,
    };
  }

  const settings =
    await getNotificationSettings();

  const leadHours =
    settings.leadTimeHours[recipient];

  const leadMs =
    leadHours *
    60 *
    60 *
    1000;

  if (untilGame > leadMs) {
    const hoursAway =
      untilGame / 60 / 60 / 1000;

    return {
      send: false,
      reason:
        `game is ${hoursAway.toFixed(1)} hours away; lead time is ${leadHours} hours`,
    };
  }

  if (
    recipient === "kopTracfone" ||
    recipient === "chTracfone"
  ) {
    if (
      !isWithinStoreHours(finalizedAt)
    ) {
      return {
        send: false,
        reason: "current time is outside store hours",
      };
    }
  }

  return {
    send: true,
    reason: "notification rules matched",
  };
}

export async function triggerCompletedBookingNotifications({
  checkoutId,
  holdId,
}: {
  checkoutId: string;
  holdId?: string | null;
}) {
  const results: Array<{
    recipient: NotificationRecipientKey;
    label: string;
    status: "sent" | "skipped" | "failed";
    reason: string;
    messageSid?: string | null;
  }> = [];

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
      return {
        results,
        error:
          "SMS notifications are disabled.",
      };
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

      return {
        results,
        error:
          "Notification source session was unavailable.",
      };
    }

    const finalizedAt = new Date();
    const message = buildMessage(session);

    const recipients =
      Object.keys(RECIPIENTS) as
      NotificationRecipientKey[];

    for (const recipient of recipients) {
      const evaluation =
        await evaluateNotification({
          recipient,
          session,
          finalizedAt,
        });

      if (!evaluation.send) {
        results.push({
          recipient,
          label:
            RECIPIENTS[recipient].label,
          status: "skipped",
          reason: evaluation.reason,
        });

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
        results.push({
          recipient,
          label:
            RECIPIENTS[recipient].label,
          status: "skipped",
          reason:
            "duplicate-send protection blocked this recipient",
        });

        continue;
      }

      const result = await sendSms({
        to: RECIPIENTS[recipient].phone,
        body: message,
        sender: "normal",
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

        results.push({
          recipient,
          label:
            RECIPIENTS[recipient].label,
          status: "failed",
          reason: result.message,
        });

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

      results.push({
        recipient,
        label:
          RECIPIENTS[recipient].label,
        status: "sent",
        reason: evaluation.reason,
        messageSid: result.messageSid,
      });

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

    if (
      session.location === "cherry-hill" &&
      session.elevatorAssistanceRequired === true
    ) {
      const elevatorClaim = await redis.set(
        elevatorSentKey(checkoutId),
        {
          status: "sending",
          claimedAt: Date.now(),
        },
        {
          nx: true,
          ex: SENT_TTL_SECONDS,
        }
      );

      if (elevatorClaim !== "OK") {
        results.push({
          recipient: "chTracfone",
          label:
            "Cherry Hill Tracfone - Elevator Thread",
          status: "skipped",
          reason:
            "duplicate-send protection blocked the elevator alert",
        });
      } else {
        const elevatorResult = await sendSms({
          to: RECIPIENTS.chTracfone.phone,
          body: message,
          sender: "elevator",
        });

        if (elevatorResult.ok === false) {
          await redis.del(
            elevatorSentKey(checkoutId)
          );

          console.error(
            "Elevator SMS notification failed.",
            {
              checkoutId,
              recipient: "chTracfone",
              reason: elevatorResult.message,
            }
          );

          results.push({
            recipient: "chTracfone",
            label:
              "Cherry Hill Tracfone - Elevator Thread",
            status: "failed",
            reason: elevatorResult.message,
          });
        } else {
          await redis.set(
            elevatorSentKey(checkoutId),
            {
              status: "sent",
              sentAt: Date.now(),
              messageSid:
                elevatorResult.messageSid,
            },
            { ex: SENT_TTL_SECONDS }
          );

          results.push({
            recipient: "chTracfone",
            label:
              "Cherry Hill Tracfone - Elevator Thread",
            status: "sent",
            reason:
              "Cherry Hill elevator booking",
            messageSid:
              elevatorResult.messageSid,
          });

          logBookingEvent(
            "notification.sent",
            {
              checkoutId,
              metadata: {
                recipient: "chTracfone",
                notificationType: "elevator",
                messageSid:
                  elevatorResult.messageSid,
              },
            }
          );
        }
      }
    }

    return {
      results,
      error: null,
    };
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "unknown";

    console.error(
      "Completed booking notification processing failed.",
      {
        checkoutId,
        reason,
      }
    );

    return {
      results,
      error: reason,
    };
  }
}
