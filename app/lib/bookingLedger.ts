import "server-only";
import { neon } from "@neondatabase/serverless";
import { BOOKING_STATES } from "./bookingState";

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

  return rows[0] ?? null;
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

  return rows[0] ?? null;
}

export async function markBookingCaptureComplete(
  checkoutId: string
) {
  const sql = getSql();

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

  return rows[0] ?? null;
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
