export type TrustedBookeoHold = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  roomSlug: string;
  roomName: string;
  image: string;
  date: string;
  time: string;
  roomCharge: string;
  promotionDiscount: string;
  tax: string;
  total: string;
  holdExpiration: string;
  createdAt: number;
};

export type BookingSession = {
  sessionId: string;
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  roomSlug: string;
  roomName: string;
  image: string;
  date: string;
  time: string;
  roomCharge: string;
  promotionDiscount: string;
  tax: string;
  total: string;
  holdExpiration: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  createdAt: number;
};

export type PaymentSession = {
  sessionId: string;
  location: string;
  roomName: string;
  image: string;
  date: string;
  time: string;
  players: string;
  roomCharge: string;
  promotionDiscount: string;
  tax: string;
  total: string;
  customerName: string;
};


export type PaymentAttempt = {
  sessionId: string;
  claimId: string;
  session: BookingSession;
  status:
    | "creating"
    | "ready"
    | "paid";
  token?: string;
  paymentUrl?: string;
  tokenIssuedAt?: number;
  transactionId?: string;
  paidAt?: number;
  createdAt: number;
  updatedAt: number;
};

export type DuplicatePaymentIncident = {
  sessionId: string;
  originalTransactionId: string;
  duplicateTransactionId: string;
  detectedAt: number;
  booking: BookingSession;
};

export type VerifiedPayment = {
  sessionId: string;
  transactionId: string;
  amount: string;
  transactionStatus: string;
  verifiedAt: number;
};

export type AuthorizeEvent = {
  eventType: string;
  transactionId: string;
  sessionId: string;
  receivedAt: number;
};

export type FinalizedBooking = {
  sessionId: string;
  bookingId: string;
  transactionId: string;
  finalizedAt: number;
};

export type OrphanPayment = {
  sessionId: string;
  transactionId: string;
  amount: string;
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  date: string;
  time: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bookeoError: unknown;
  createdAt: number;
  status:
    | "needs_recovery"
    | "reconciled"
    | "recovered";
  failureType:
    | "bookeo_rejected"
    | "uncertain"
    | "payment_received_pending_finalization";
};

export function isValidCalendarDate(
  value: string
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] =
    value.split("-").map(Number);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}


const EASTERN_TIME_ZONE = "America/New_York";

function getEasternOffsetAtInstant(
  instant: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          EASTERN_TIME_ZONE,
        timeZoneName:
          "longOffset",
      }
    ).formatToParts(instant);

  const offset =
    parts.find(
      (part) =>
        part.type ===
        "timeZoneName"
    )?.value;

  if (
    !offset ||
    !/^GMT[+-]\d{2}:\d{2}$/.test(
      offset
    )
  ) {
    throw new Error(
      "Could not determine America/New_York UTC offset."
    );
  }

  return offset.replace(
    "GMT",
    ""
  );
}

function resolveEasternOffsetForLocalTime(
  dateString: string,
  hour: number,
  minute: number,
  second: number
) {
  if (
    !isValidCalendarDate(
      dateString
    )
  ) {
    throw new Error(
      "Invalid calendar date."
    );
  }

  const [year, month, day] =
    dateString
      .split("-")
      .map(Number);

  const localWallClockUtc =
    Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute,
      second
    );

  /*
   * Resolve the UTC offset for this exact Eastern-local
   * wall-clock time. Two passes are enough for the
   * America/New_York DST offsets because midnight and
   * 23:59:59 are never inside the DST transition gap.
   */
  let candidate =
    new Date(
      localWallClockUtc
    );

  for (
    let attempt = 0;
    attempt < 2;
    attempt++
  ) {
    const offset =
      getEasternOffsetAtInstant(
        candidate
      );

    const sign =
      offset.startsWith("-")
        ? -1
        : 1;

    const [offsetHours, offsetMinutes] =
      offset
        .slice(1)
        .split(":")
        .map(Number);

    const totalOffsetMinutes =
      sign *
      (
        offsetHours * 60 +
        offsetMinutes
      );

    candidate =
      new Date(
        localWallClockUtc -
        totalOffsetMinutes *
          60_000
      );
  }

  return getEasternOffsetAtInstant(
    candidate
  );
}

export function getTodayEastern() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          EASTERN_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const year =
    parts.find(
      (part) =>
        part.type === "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type === "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
        part.type === "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "Could not determine the current Eastern date."
    );
  }

  return `${year}-${month}-${day}`;
}

export function getEasternDayBounds(
  dateString: string
) {
  const startOffset =
    resolveEasternOffsetForLocalTime(
      dateString,
      0,
      0,
      0
    );

  const endOffset =
    resolveEasternOffsetForLocalTime(
      dateString,
      23,
      59,
      59
    );

  return {
    startTime:
      `${dateString}T00:00:00${startOffset}`,
    endTime:
      `${dateString}T23:59:59${endOffset}`,
  };
}

export function isValidBookingSessionId(
  value: string
) {
  return /^ERM-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}