import { NextResponse } from "next/server";
import {
  createBookingLedgerRecord,
  getBookingLedgerRecord,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";

export async function GET() {
  const checkoutId =
    "TEST-" + Date.now().toString();

  const created =
    await createBookingLedgerRecord({
      checkoutId,
      holdId: "TEST-HOLD-123",
      status: "HOLD_CREATED",
    });

  const updated =
    await updateBookingLedgerRecord({
      checkoutId,
      authorizeTransactionId:
        "TEST-AUTH-456",
      status: "AUTHORIZED",
    });

  const fetched =
    await getBookingLedgerRecord(
      checkoutId
    );

  return NextResponse.json({
    created,
    updated,
    fetched,
  });
}