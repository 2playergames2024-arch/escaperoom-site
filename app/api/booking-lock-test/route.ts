import { NextResponse } from "next/server";
import {
  claimCheckoutForAuthorization,
  createBookingLedgerRecord,
  getBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import { BOOKING_STATES } from "@/app/lib/bookingState";

export async function GET() {
  const checkoutId =
    "LOCK-TEST-" + Date.now().toString();

  await createBookingLedgerRecord({
    checkoutId,
    holdId: "LOCK-TEST-HOLD",
    status: BOOKING_STATES.HOLD_CREATED,
  });

  const [attemptOne, attemptTwo] =
    await Promise.all([
      claimCheckoutForAuthorization(
        checkoutId
      ),
      claimCheckoutForAuthorization(
        checkoutId
      ),
    ]);

  const finalRecord =
    await getBookingLedgerRecord(
      checkoutId
    );

  const successfulClaims = [
    attemptOne,
    attemptTwo,
  ].filter(Boolean).length;

  return NextResponse.json({
    checkoutId,
    successfulClaims,
    attemptOneWon:
      attemptOne !== null,
    attemptTwoWon:
      attemptTwo !== null,
    finalStatus:
      finalRecord?.status ?? null,
  });
}