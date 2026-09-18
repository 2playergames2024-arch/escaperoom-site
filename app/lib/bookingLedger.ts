import "server-only";
import { neon } from "@neondatabase/serverless";
import { BOOKING_STATES } from "./bookingState";
import { logBookingEvent } from "./bookingLog";

function getSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  return neon(databaseUrl);
}

export type BookingLedgerRecord = {
  checkoutId: string;
  holdId: string | null;
  authorizeTransactionId: string | null;
  bookeoBookingId: string | null;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  errorData: unknown;
  createdAt: string;
  updatedAt: string;
};

export async function createBookingLedgerRecord({
  checkoutId,
  holdId,
  status,
}: {
  checkoutId: string;
  holdId?: string | null;
  status: string;
}) {
  const sql = getSql();

  const rows = await sql`
    INSERT INTO booking_ledger (
      checkout_id,
      hold_id,
      status
    )
    VALUES (
      ${checkoutId},
      ${holdId ?? null},
      ${status}
    )
    RETURNING *
  `;

  logBookingEvent(
    "ledger.created",
    {
      checkoutId,
      holdId:
        holdId ?? null,
      nextStatus:
        status,
      status,
    }
  );

  return rows[0];
}

export async function getBookingLedgerRecord(
  checkoutId: string
) {
  const sql = getSql();

  const rows = await sql`
    SELECT *
    FROM booking_ledger
    WHERE checkout_id = ${checkoutId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function updateBookingLedgerRecord({
  checkoutId,
  holdId,
  authorizeTransactionId,
  bookeoBookingId,
  status,
  errorCode,
  errorMessage,
  errorData,
}: {
  checkoutId: string;
  holdId?: string | null;
  authorizeTransactionId?: string | null;
  bookeoBookingId?: string | null;
  status?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorData?: unknown;
}) {
  const sql = getSql();

  const before =
    await getBookingLedgerRecord(
      checkoutId
    );

  const rows = await sql`
    UPDATE booking_ledger
    SET
      hold_id =
        COALESCE(
          ${holdId ?? null},
          hold_id
        ),
      authorize_transaction_id =
        COALESCE(
          ${authorizeTransactionId ?? null},
          authorize_transaction_id
        ),
      bookeo_booking_id =
        COALESCE(
          ${bookeoBookingId ?? null},
          bookeo_booking_id
        ),
      status =
        COALESCE(
          ${status ?? null},
          status
        ),
      error_code =
        COALESCE(
          ${errorCode ?? null},
          error_code
        ),
      error_message =
        COALESCE(
          ${errorMessage ?? null},
          error_message
        ),
      error_data =
        COALESCE(
          ${errorData === undefined
            ? null
            : JSON.stringify(errorData)}::jsonb,
          error_data
        ),
      updated_at = NOW()
    WHERE checkout_id = ${checkoutId}
    RETURNING *
  `;

  const updated =
    rows[0] ?? null;

  logBookingEvent(
    "ledger.updated",
    {
      checkoutId,
      holdId:
        holdId ??
        updated?.hold_id ??
        null,
      authorizeTransactionId:
        authorizeTransactionId ??
        updated?.authorize_transaction_id ??
        null,
      bookeoBookingId:
        bookeoBookingId ??
        updated?.bookeo_booking_id ??
        null,
      previousStatus:
        before?.status ?? null,
      nextStatus:
        updated?.status ?? status ?? null,
      status:
        updated?.status ?? status ?? null,
      errorCode:
        errorCode ??
        updated?.error_code ??
        null,
    },
    updated
      ? "info"
      : "warn"
  );

  return updated;
}
export async function claimCheckoutForAuthorization(
  checkoutId: string
) {
  const sql = getSql();

  const rows = await sql`
    UPDATE booking_ledger
    SET
      status = ${BOOKING_STATES.AUTHORIZING},
      updated_at = NOW()
    WHERE
      checkout_id = ${checkoutId}
      AND status = ${BOOKING_STATES.HOLD_CREATED}
    RETURNING *
  `;

  const claimed =
    rows[0] ?? null;

  logBookingEvent(
    claimed
      ? "authorization.claimed"
      : "authorization.claim_rejected",
    {
      checkoutId,
      previousStatus:
        BOOKING_STATES.HOLD_CREATED,
      nextStatus:
        claimed
          ? BOOKING_STATES.AUTHORIZING
          : null,
      status:
        claimed?.status ?? null,
    },
    claimed
      ? "info"
      : "warn"
  );

  return claimed;
}

export async function markBookingCaptureComplete(
  checkoutId: string
) {
  const sql = getSql();

  const before =
    await getBookingLedgerRecord(
      checkoutId
    );

  const rows = await sql`
    UPDATE booking_ledger
    SET
      status = ${BOOKING_STATES.COMPLETE},
      error_code = NULL,
      error_message = NULL,
      error_data = NULL,
      updated_at = NOW()
    WHERE checkout_id = ${checkoutId}
    RETURNING *
  `;

  const completed =
    rows[0] ?? null;

  logBookingEvent(
    "booking.completed",
    {
      checkoutId,
      previousStatus:
        before?.status ?? null,
      nextStatus:
        completed?.status ??
        BOOKING_STATES.COMPLETE,
      status:
        completed?.status ??
        BOOKING_STATES.COMPLETE,
      authorizeTransactionId:
        completed?.authorize_transaction_id ??
        null,
      bookeoBookingId:
        completed?.bookeo_booking_id ??
        null,
    },
    completed
      ? "info"
      : "warn"
  );

  return completed;
}

export async function getBookingLedgerRecordByAuthorizeTransactionId(
  authorizeTransactionId: string
) {
  const sql = getSql();

  const rows = await sql`
    SELECT *
    FROM booking_ledger
    WHERE authorize_transaction_id = ${authorizeTransactionId}
    ORDER BY created_at ASC
    LIMIT 2
  `;

  if (rows.length === 0) {
    return {
      kind: "NOT_FOUND" as const,
      record: null,
    };
  }

  if (rows.length > 1) {
    return {
      kind: "AMBIGUOUS" as const,
      record: null,
    };
  }

  return {
    kind: "FOUND" as const,
    record: rows[0],
  };
}

export async function getBookingLedgerReconciliationCandidates({
  olderThanSeconds = 60,
  newerThanHours = 6,
  limit = 25,
}: {
  olderThanSeconds?: number;
  newerThanHours?: number;
  limit?: number;
}) {
  const sql = getSql();

  const safeLimit =
    Math.max(
      1,
      Math.min(
        100,
        Math.floor(limit)
      )
    );

  const rows = await sql`
    SELECT *
    FROM booking_ledger
    WHERE
      authorize_transaction_id IS NOT NULL
      AND status IN (
        ${BOOKING_STATES.AUTHORIZED},
        ${BOOKING_STATES.BOOKED},
        ${BOOKING_STATES.CAPTURE_FAILED}
      )
      AND updated_at <=
        NOW() -
        (${olderThanSeconds} * INTERVAL '1 second')
      AND updated_at >=
        NOW() -
        (${newerThanHours} * INTERVAL '1 hour')
    ORDER BY updated_at ASC
    LIMIT ${safeLimit}
  `;

  return rows;
}
