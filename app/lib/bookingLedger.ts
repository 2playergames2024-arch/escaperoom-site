import "server-only";
import { neon } from "@neondatabase/serverless";

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