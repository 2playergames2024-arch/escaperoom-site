import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  resolveNotificationAdminRole,
} from "@/app/lib/notificationAdminAuth";
import {
  DAY_KEYS,
  DEFAULT_DAY_MATRIX,
  RECIPIENTS,
  STORE_HOURS,
  canEditRecipient,
  getAllEffectiveDays,
  getNotificationSettings,
  getPermissions,
  setTemporaryDays,
  updateLeadTimeHours,
  type DayKey,
  type NotificationLocation,
  type NotificationRecipientKey,
} from "@/app/lib/notificationSettings";

const redis = Redis.fromEnv();

function getClientIp(request: Request) {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function authenticate(request: Request) {
  const role =
    resolveNotificationAdminRole(
      request.headers.get(
        "x-notification-secret"
      )
    );

  if (role) {
    return { response: null, role };
  }

  const ip = getClientIp(request);
  const attempts =
    await incrementRateLimit(
      redis,
      `rate-limit:admin-notifications:${ip}`,
      600
    );

  if (attempts > 20) {
    return {
      response: NextResponse.json(
        { error: "Too many invalid access-code attempts." },
        {
          status: 429,
          headers: { "Retry-After": "600" },
        }
      ),
      role: null,
    };
  }

  return {
    response: NextResponse.json(
      { error: "Unauthorized." },
      { status: 401 }
    ),
    role: null,
  };
}

function getAllowedLocations(
  recipient: NotificationRecipientKey
): NotificationLocation[] {
  if (recipient === "kopTracfone") {
    return ["king-of-prussia"];
  }

  if (recipient === "chTracfone") {
    return ["cherry-hill"];
  }

  return [
    "king-of-prussia",
    "cherry-hill",
  ];
}

export async function GET(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.response || !auth.role) {
      return auth.response!;
    }

    const [settings, effectiveDays] =
      await Promise.all([
        getNotificationSettings(),
        getAllEffectiveDays(),
      ]);

    return NextResponse.json({
      permissions: getPermissions(auth.role),
      settings,
      effectiveDays,
      defaults: DEFAULT_DAY_MATRIX,
      recipients: Object.fromEntries(
        Object.entries(RECIPIENTS).map(
          ([key, value]) => [
            key,
            {
              label: value.label,
              phoneLast4:
                value.phone.slice(-4),
              manager: value.manager,
            },
          ]
        )
      ),
      storeHours: STORE_HOURS,
      smsEnabled:
        process.env.SMS_NOTIFICATIONS_ENABLED ===
        "true",
    });
  } catch (error) {
    console.error(
      "Notification administration GET failed.",
      error
    );
    return NextResponse.json(
      { error: "Could not load notification settings." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authenticate(request);
    if (auth.response || !auth.role) {
      return auth.response!;
    }

    const body = await request.json();

    if (body.action !== "saveAll") {
      return NextResponse.json(
        { error: "Unknown action." },
        { status: 400 }
      );
    }

    const leadTimeHours =
      body.leadTimeHours &&
      typeof body.leadTimeHours === "object"
        ? body.leadTimeHours as Record<string, unknown>
        : {};

    const effectiveDays =
      body.effectiveDays &&
      typeof body.effectiveDays === "object"
        ? body.effectiveDays as Record<
            string,
            Record<string, unknown>
          >
        : {};

    for (
      const recipient of Object.keys(
        RECIPIENTS
      ) as NotificationRecipientKey[]
    ) {
      if (!canEditRecipient(auth.role, recipient)) {
        continue;
      }

      const hours = Number(
        leadTimeHours[recipient]
      );

      if (
        !Number.isFinite(hours) ||
        hours < 1 ||
        hours > 168
      ) {
        return NextResponse.json(
          {
            error:
              "Lead time must be between 1 and 168 hours.",
          },
          { status: 400 }
        );
      }

      await updateLeadTimeHours(
        auth.role,
        recipient,
        hours
      );

      for (
        const location of getAllowedLocations(
          recipient
        )
      ) {
        const rawDays =
          effectiveDays[recipient]?.[location];
        const days: string[] =
          Array.isArray(rawDays)
            ? rawDays.map((day: unknown) =>
                String(day)
              )
            : [];

        if (
          days.some(
            (day) =>
              !DAY_KEYS.includes(
                day as DayKey
              )
          )
        ) {
          return NextResponse.json(
            { error: "Invalid day selection." },
            { status: 400 }
          );
        }

        await setTemporaryDays(
          auth.role,
          recipient,
          location,
          days as DayKey[]
        );
      }
    }

    const [settings, savedDays] =
      await Promise.all([
        getNotificationSettings(),
        getAllEffectiveDays(),
      ]);

    return NextResponse.json({
      settings,
      effectiveDays: savedDays,
    });
  } catch (error) {
    console.error(
      "Notification administration PATCH failed.",
      error
    );
    return NextResponse.json(
      { error: "Could not update notification settings." },
      { status: 500 }
    );
  }
}
