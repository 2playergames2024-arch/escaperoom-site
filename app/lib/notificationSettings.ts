import "server-only";
import { Redis } from "@upstash/redis";
import type { NotificationAdminRole } from "./notificationAdminAuth";

const redis = Redis.fromEnv();

export const EASTERN_TIME_ZONE =
  "America/New_York";

export const DAY_KEYS = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
] as const;

export type DayKey =
  (typeof DAY_KEYS)[number];

export type NotificationLocation =
  | "king-of-prussia"
  | "cherry-hill";

export type NotificationRecipientKey =
  | "noel"
  | "david"
  | "kopTracfone"
  | "chTracfone";

export type NotificationSettings = {
  leadTimeHours: Record<
    NotificationRecipientKey,
    number
  >;
};

export type DayMatrix = Record<
  NotificationRecipientKey,
  Record<NotificationLocation, DayKey[]>
>;

export const RECIPIENTS = {
  noel: {
    label: "Noel - KOP Site Manager",
    phone: "+14849427519",
    manager: true,
  },
  david: {
    label: "David - Cherry Hill Site Manager",
    phone: "+18565346794",
    manager: true,
  },
  kopTracfone: {
    label: "King of Prussia Tracfone",
    phone: "+12672200934",
    manager: false,
  },
  chTracfone: {
    label: "Cherry Hill Tracfone",
    phone: "+12672803946",
    manager: false,
  },
} as const;

export const STORE_HOURS: Record<
  DayKey,
  { start: string; end: string }
> = {
  sun: { start: "13:00", end: "19:00" },
  mon: { start: "12:00", end: "21:00" },
  tue: { start: "12:00", end: "21:00" },
  wed: { start: "12:00", end: "21:00" },
  thu: { start: "12:00", end: "21:00" },
  fri: { start: "12:00", end: "22:30" },
  sat: { start: "10:30", end: "22:45" },
};

export const DEFAULT_DAY_MATRIX: DayMatrix = {
  noel: {
    "king-of-prussia": [
      "mon",
      "tue",
      "wed",
      "fri",
      "sat",
    ],
    "cherry-hill": ["mon", "tue"],
  },
  david: {
    "king-of-prussia": ["sun", "thu"],
    "cherry-hill": [
      "sun",
      "wed",
      "thu",
      "fri",
      "sat",
    ],
  },
  kopTracfone: {
    "king-of-prussia": [...DAY_KEYS],
    "cherry-hill": [],
  },
  chTracfone: {
    "king-of-prussia": [],
    "cherry-hill": [...DAY_KEYS],
  },
};

const DEFAULT_SETTINGS: NotificationSettings = {
  leadTimeHours: {
    noel: 24,
    david: 24,
    kopTracfone: 24,
    chTracfone: 24,
  },
};

const SETTINGS_KEY =
  "notification-settings:v1";

function dayOverrideKey(
  recipient: NotificationRecipientKey,
  location: NotificationLocation,
  day: DayKey
) {
  return `notification-day-override:v2:${recipient}:${location}:${day}`;
}

function normalizeLeadTime(
  value: unknown,
  fallback: number
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1 ||
    parsed > 168
  ) {
    return fallback;
  }

  return Math.round(parsed * 10) / 10;
}

function getEasternCalendarParts(
  date = new Date()
) {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
    }).formatToParts(date);

  const value = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value ?? "";

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    weekday: value("weekday")
      .toLowerCase()
      .slice(0, 3) as DayKey,
  };
}

function getTimeZoneOffsetMs(
  date: Date
) {
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

  const value = (type: string) =>
    Number(
      parts.find((part) => part.type === type)
        ?.value ?? "0"
    );

  const representedAsUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    value("hour"),
    value("minute"),
    value("second")
  );

  return representedAsUtc - date.getTime();
}

function easternLocalMidnightToUtcMs(
  year: number,
  month: number,
  day: number
) {
  const desiredAsUtc = Date.UTC(
    year,
    month - 1,
    day,
    0,
    0,
    0
  );

  let candidate = new Date(desiredAsUtc);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const offset = getTimeZoneOffsetMs(candidate);
    candidate = new Date(
      desiredAsUtc - offset
    );
  }

  return candidate.getTime();
}

function getSecondsUntilDayEnds(
  targetDay: DayKey,
  now = new Date()
) {
  const current = getEasternCalendarParts(now);
  const currentIndex = DAY_KEYS.indexOf(
    current.weekday
  );
  const targetIndex = DAY_KEYS.indexOf(
    targetDay
  );

  const daysAhead =
    (targetIndex - currentIndex + 7) % 7;

  const targetDate = new Date(
    Date.UTC(
      current.year,
      current.month - 1,
      current.day + daysAhead
    )
  );

  const nextDay = new Date(
    Date.UTC(
      targetDate.getUTCFullYear(),
      targetDate.getUTCMonth(),
      targetDate.getUTCDate() + 1
    )
  );

  const expiresAt =
    easternLocalMidnightToUtcMs(
      nextDay.getUTCFullYear(),
      nextDay.getUTCMonth() + 1,
      nextDay.getUTCDate()
    );

  return Math.max(
    60,
    Math.ceil((expiresAt - now.getTime()) / 1000)
  );
}

export function getEasternDayKey(
  date = new Date()
): DayKey {
  return getEasternCalendarParts(date).weekday;
}

export async function getNotificationSettings() {
  const stored =
    await redis.get<Partial<NotificationSettings>>(
      SETTINGS_KEY
    );

  return {
    leadTimeHours: {
      noel: normalizeLeadTime(
        stored?.leadTimeHours?.noel,
        DEFAULT_SETTINGS.leadTimeHours.noel
      ),
      david: normalizeLeadTime(
        stored?.leadTimeHours?.david,
        DEFAULT_SETTINGS.leadTimeHours.david
      ),
      kopTracfone: normalizeLeadTime(
        stored?.leadTimeHours?.kopTracfone,
        DEFAULT_SETTINGS.leadTimeHours.kopTracfone
      ),
      chTracfone: normalizeLeadTime(
        stored?.leadTimeHours?.chTracfone,
        DEFAULT_SETTINGS.leadTimeHours.chTracfone
      ),
    },
  } satisfies NotificationSettings;
}

export async function updateLeadTimeHours(
  role: NotificationAdminRole,
  recipient: NotificationRecipientKey,
  hours: number
) {
  if (!canEditRecipient(role, recipient)) {
    throw new Error("FORBIDDEN");
  }

  const current =
    await getNotificationSettings();

  current.leadTimeHours[recipient] =
    normalizeLeadTime(
      hours,
      current.leadTimeHours[recipient]
    );

  await redis.set(SETTINGS_KEY, current);

  return current;
}

async function getDayOverride(
  recipient: NotificationRecipientKey,
  location: NotificationLocation,
  day: DayKey
) {
  const value = await redis.get<string>(
    dayOverrideKey(
      recipient,
      location,
      day
    )
  );

  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export async function getEffectiveDays(
  recipient: NotificationRecipientKey,
  location: NotificationLocation
) {
  const defaults =
    DEFAULT_DAY_MATRIX[recipient][location];
  const effective: DayKey[] = [];

  for (const day of DAY_KEYS) {
    const override = await getDayOverride(
      recipient,
      location,
      day
    );

    const enabled =
      override ?? defaults.includes(day);

    if (enabled) {
      effective.push(day);
    }
  }

  return effective;
}

export async function getAllEffectiveDays() {
  const result = {} as DayMatrix;

  for (
    const recipient of Object.keys(
      RECIPIENTS
    ) as NotificationRecipientKey[]
  ) {
    result[recipient] = {
      "king-of-prussia":
        await getEffectiveDays(
          recipient,
          "king-of-prussia"
        ),
      "cherry-hill":
        await getEffectiveDays(
          recipient,
          "cherry-hill"
        ),
    };
  }

  return result;
}

export async function setTemporaryDays(
  role: NotificationAdminRole,
  recipient: NotificationRecipientKey,
  location: NotificationLocation,
  days: DayKey[]
) {
  if (!canEditRecipient(role, recipient)) {
    throw new Error("FORBIDDEN");
  }

  const sanitized = DAY_KEYS.filter(
    (day) => days.includes(day)
  );
  const defaults =
    DEFAULT_DAY_MATRIX[recipient][location];

  for (const day of DAY_KEYS) {
    const enabled = sanitized.includes(day);
    const defaultEnabled =
      defaults.includes(day);
    const key = dayOverrideKey(
      recipient,
      location,
      day
    );

    if (enabled === defaultEnabled) {
      await redis.del(key);
      continue;
    }

    await redis.set(
      key,
      enabled ? "1" : "0",
      {
        ex: getSecondsUntilDayEnds(day),
      }
    );
  }

  return sanitized;
}

export function canEditRecipient(
  role: NotificationAdminRole,
  _recipient: NotificationRecipientKey
) {
  return (
    role === "owner" ||
    role === "noel" ||
    role === "david"
  );
}

export function getPermissions(
  role: NotificationAdminRole
) {
  return {
    role,
    editableRecipients: (
      Object.keys(RECIPIENTS) as
        NotificationRecipientKey[]
    ).filter((recipient) =>
      canEditRecipient(role, recipient)
    ),
  };
}

export function isWithinStoreHours(
  date = new Date()
) {
  const day = getEasternDayKey(date);
  const parts =
    new Intl.DateTimeFormat("en-US", {
      timeZone: EASTERN_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

  const hour = Number(
    parts.find((part) =>
      part.type === "hour"
    )?.value ?? "0"
  );
  const minute = Number(
    parts.find((part) =>
      part.type === "minute"
    )?.value ?? "0"
  );
  const currentMinutes =
    hour * 60 + minute;

  const toMinutes = (value: string) => {
    const [h, m] = value
      .split(":")
      .map(Number);
    return h * 60 + m;
  };

  const hours = STORE_HOURS[day];

  return (
    currentMinutes >=
      toMinutes(hours.start) &&
    currentMinutes <=
      toMinutes(hours.end)
  );
}
