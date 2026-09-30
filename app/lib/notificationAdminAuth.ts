import "server-only";
import { timingSafeEqual } from "crypto";

export type NotificationAdminRole =
  | "owner"
  | "noel"
  | "david";

function safeEqual(
  supplied: string,
  expected: string
) {
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export function resolveNotificationAdminRole(
  suppliedSecret: string | null
): NotificationAdminRole | null {
  if (!suppliedSecret) {
    return null;
  }

  const candidates: Array<[
    NotificationAdminRole,
    string | undefined
  ]> = [
    [
      "owner",
      process.env.NOTIFICATION_OWNER_SECRET,
    ],
    [
      "noel",
      process.env.NOTIFICATION_NOEL_SECRET,
    ],
    [
      "david",
      process.env.NOTIFICATION_DAVID_SECRET,
    ],
  ];

  for (const [role, expected] of candidates) {
    if (
      expected &&
      safeEqual(suppliedSecret, expected)
    ) {
      return role;
    }
  }

  return null;
}
