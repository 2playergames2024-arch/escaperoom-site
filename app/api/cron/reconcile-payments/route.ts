import {
  NextRequest,
  NextResponse,
} from "next/server";

import { Redis } from "@upstash/redis";

import {
  getBookingLedgerReconciliationCandidates,
  getBookeoPaymentSyncManualReviewCandidates,
} from "@/app/lib/bookingLedger";
import {
  markBookeoPaymentSyncManualReview,
  reconcileBookingLedgerRow,
} from "@/app/lib/bookingReconciliation";
import {
  logBookingEvent,
} from "@/app/lib/bookingLog";

const redis = Redis.fromEnv();

const RECONCILIATION_LOCK_SECONDS =
  120;

export async function GET(
  req: NextRequest
) {
  const authHeader =
    req.headers.get(
      "authorization"
    );

  const cronSecret =
    process.env.CRON_SECRET;

  if (
    !cronSecret ||
    authHeader !==
      `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      }
    );
  }

  const candidates =
    await getBookingLedgerReconciliationCandidates({
      olderThanSeconds: 60,
      newerThanHours: 6,
      limit: 25,
    });

  const stalePaymentSyncCandidates =
    await getBookeoPaymentSyncManualReviewCandidates({
      olderThanHours: 6,
      limit: 25,
    });

  let checked = 0;
  let locked = 0;
  let repaired = 0;
  let manualReview = 0;
  let unchanged = 0;

  const results: Array<{
    checkoutId: string;
    action: string;
    ok: boolean;
  }> = [];

  for (const row of candidates) {
    const checkoutId =
      String(
        row.checkout_id ||
        row.checkoutId ||
        ""
      ).trim();

    if (!checkoutId) {
      continue;
    }

    checked++;

    const lockKey =
      `booking-v2-reconciliation-lock:${checkoutId}`;

    const lockToken =
      crypto.randomUUID();

    const claimed =
      await redis.set(
        lockKey,
        lockToken,
        {
          nx: true,
          ex:
            RECONCILIATION_LOCK_SECONDS,
        }
      );

    if (claimed !== "OK") {
      locked++;
      continue;
    }

    try {
      const result =
        await reconcileBookingLedgerRow(
          row
        );

      results.push({
        checkoutId:
          result.checkoutId,
        action:
          result.action,
        ok:
          result.ok,
      });

      if (
        result.action ===
          "MARKED_COMPLETE" ||
        result.action ===
          "BOOKEO_FOUND_AND_COMPLETE" ||
        result.action ===
          "BOOKEO_FOUND_AND_CAPTURED" ||
        result.action ===
          "CAPTURE_RECOVERED" ||
        result.action ===
          "MARKED_VOIDED"
      ) {
        repaired++;
      } else if (
        result.action ===
        "MANUAL_REVIEW"
      ) {
        manualReview++;
      } else {
        unchanged++;
      }
    } catch (error) {
      manualReview++;

      console.error(
        "booking-v2 delayed reconciliation failed.",
        {
          checkoutId,
          reason:
            error instanceof Error
              ? error.name
              : "unknown",
        }
      );
    } finally {
      try {
        const currentToken =
          await redis.get<string>(
            lockKey
          );

        if (
          currentToken ===
          lockToken
        ) {
          await redis.del(
            lockKey
          );
        }
      } catch (error) {
        console.error(
          "booking-v2 reconciliation lock release failed.",
          {
            checkoutId,
            reason:
              error instanceof Error
                ? error.name
                : "unknown",
          }
        );
      }
    }
  }

  for (const row of stalePaymentSyncCandidates) {
    const checkoutId =
      String(
        row.checkout_id ||
        row.checkoutId ||
        ""
      ).trim();

    if (!checkoutId) {
      continue;
    }

    const result =
      await markBookeoPaymentSyncManualReview(
        row
      );

    results.push({
      checkoutId:
        result.checkoutId,
      action:
        result.action,
      ok:
        result.ok,
    });

    manualReview++;
  }

  logBookingEvent(
    "reconciliation.run_complete",
    {
      result: "complete",
      metadata: {
        checked,
        locked,
        repaired,
        manualReview,
        unchanged,
      },
    },
    manualReview > 0
      ? "warn"
      : "info"
  );

  return NextResponse.json({
    ok: true,
    checked,
    locked,
    repaired,
    manualReview,
    unchanged,
    results,
  });
}
