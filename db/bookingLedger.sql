CREATE TABLE IF NOT EXISTS booking_ledger (
  checkout_id TEXT PRIMARY KEY,
  hold_id TEXT,
  authorize_transaction_id TEXT,
  bookeo_booking_id TEXT,
  status TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT,
  error_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS
  booking_ledger_authorize_transaction_id_idx
ON booking_ledger (authorize_transaction_id);

CREATE INDEX IF NOT EXISTS
  booking_ledger_bookeo_booking_id_idx
ON booking_ledger (bookeo_booking_id);