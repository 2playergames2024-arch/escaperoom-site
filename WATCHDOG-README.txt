# 30-Second Booking Watchdog Package

This package implements the agreed customer-facing timing and timeout recovery flow.

## Timing

- 0-10 seconds: "Confirming your booking..."
- 10 seconds: "This is taking a little longer than expected. Thanks for your patience."
- 20 seconds: "We're still processing your booking and payment. Please do not refresh or submit payment again."
- 30 seconds: watchdog takeover begins and the UI says:
  "We're verifying your booking and payment status now. Please do not refresh or submit payment again."

The Authorize.Net AUTH-ONLY HTTP timeout is changed from 15 seconds to 30 seconds.

## Safety model

- The original payment route owns the checkout while it is active.
- At 30 seconds the watchdog requests takeover.
- The watchdog does not mutate Authorize.Net or Bookeo until the original payment route releases ownership.
- The original route checks for takeover before starting new consequential operations.
- If Bookeo exists and Authorize.Net is captured, checkout is COMPLETE.
- Otherwise the watchdog attempts to unwind safely.
- Failure is shown only after required cleanup is positively confirmed.
- If an external service cannot be verified, the checkout remains pending and Pay stays locked.
- Bookeo cancellations are silent to customer/users and do not apply the Bookeo cancellation policy.
- Bookeo temporary holds are explicitly deleted when a checkout is failed cleanly.
- Delayed reconciliation skips a checkout while the live watchdog takeover flag exists.

## Files

Modified:
- app/book/payment/page.tsx
- app/api/authorize/auth-only/route.ts
- app/lib/bookingReconciliation.ts

New:
- app/api/booking-watchdog/route.ts
- app/lib/bookingWatchdog.ts
- app/lib/bookeoCancellation.ts

## After extracting

Run:

npm.cmd run lint
npm.cmd run build

Do not push to Production until both pass and the Preview test is satisfactory.
