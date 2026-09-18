import "server-only";

type BookingLogLevel =
  | "info"
  | "warn"
  | "error";

type BookingLogFields = {
  checkoutId?: string | null;
  sessionId?: string | null;
  holdId?: string | null;
  authorizeTransactionId?: string | null;
  bookeoBookingId?: string | null;
  previousStatus?: string | null;
  nextStatus?: string | null;
  status?: string | null;
  result?: string | null;
  errorCode?: string | null;
  attempt?: number | null;
  metadata?: Record<string, unknown> | null;
};

const SENSITIVE_KEY_PATTERN =
  /(secret|password|token|signature|credential|authorization|opaque|dataValue|card|cvv|cvc|accountNumber|transactionKey|loginId|apiKey)/i;

function sanitizeValue(
  value: unknown,
  depth = 0
): unknown {
  if (depth > 4) {
    return "[max-depth]";
  }

  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) =>
        sanitizeValue(
          item,
          depth + 1
        )
      );
  }

  if (typeof value === "object") {
    const output:
      Record<string, unknown> = {};

    for (
      const [key, childValue]
      of Object.entries(
        value as Record<string, unknown>
      )
    ) {
      output[key] =
        SENSITIVE_KEY_PATTERN.test(key)
          ? "[redacted]"
          : sanitizeValue(
              childValue,
              depth + 1
            );
    }

    return output;
  }

  return String(value);
}

export function logBookingEvent(
  event: string,
  fields: BookingLogFields = {},
  level: BookingLogLevel = "info"
) {
  const payload = {
    timestamp:
      new Date().toISOString(),
    service: "booking-v2",
    event,
    level,
    checkoutId:
      fields.checkoutId ?? null,
    sessionId:
      fields.sessionId ?? null,
    holdId:
      fields.holdId ?? null,
    authorizeTransactionId:
      fields.authorizeTransactionId ?? null,
    bookeoBookingId:
      fields.bookeoBookingId ?? null,
    previousStatus:
      fields.previousStatus ?? null,
    nextStatus:
      fields.nextStatus ?? null,
    status:
      fields.status ?? null,
    result:
      fields.result ?? null,
    errorCode:
      fields.errorCode ?? null,
    attempt:
      fields.attempt ?? null,
    metadata:
      sanitizeValue(
        fields.metadata ?? null
      ),
  };

  const line =
    JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}
