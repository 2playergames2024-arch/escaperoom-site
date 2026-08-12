import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const BOOKEO_API_KEY = process.env.BOOKEO_API_KEY;
const BOOKEO_SECRET_KEY = process.env.BOOKEO_SECRET_KEY;

type OrphanPayment = {
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
  status: "needs_recovery" | "reconciled" | "recovered";
  failureType: "bookeo_rejected" | "uncertain";
  lastReconciliationResult?: "no_match" | "ambiguous";
  lastReconciledAt?: number;
};

type BookeoBooking = {
  bookingNumber?: string;
  eventId?: string;
  productId?: string;
  canceled?: boolean;
  participants?: {
    numbers?: Array<{
      peopleCategoryId?: string;
      number?: number;
    }>;
  };
  price?: {
    totalPaid?: {
      amount?: string;
    };
  };
};

export async function POST(request: Request) {
  let lockKey = "";
  let lockToken = "";
  let lockAcquired = false;

  try {
    const adminSecret = process.env.ADMIN_RECOVERY_SECRET;

    if (!adminSecret) {
      return NextResponse.json(
        { error: "Recovery administration is not configured." },
        { status: 500 }
      );
    }

    if (request.headers.get("x-admin-secret") !== adminSecret) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    const loginId = process.env.AUTHORIZE_LOGIN_ID;
    const transactionKey =
      process.env.AUTHORIZE_TRANSACTION_KEY;
    const authorizeEnvironment =
      process.env.AUTHORIZE_ENVIRONMENT || "production";

    if (!loginId || !transactionKey) {
      return NextResponse.json(
        { error: "Authorize.net credentials are missing." },
        { status: 500 }
      );
    }

    if (!BOOKEO_API_KEY || !BOOKEO_SECRET_KEY) {
      return NextResponse.json(
        { error: "Bookeo API credentials are missing." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    const orphan = await redis.get<OrphanPayment>(
      `orphan-payment:${sessionId}`
    );

    if (!orphan) {
      return NextResponse.json(
        { error: "Orphan payment not found." },
        { status: 404 }
      );
    }

    if (orphan.status !== "needs_recovery") {
      return NextResponse.json(
        {
          error: "This orphan is not awaiting recovery.",
        },
        { status: 409 }
      );
    }

    /*
     * Recovery is only permitted after reconciliation
     * explicitly found no matching Bookeo booking.
     */
    if (
      orphan.lastReconciliationResult !== "no_match" ||
      !orphan.lastReconciledAt
    ) {
      return NextResponse.json(
        {
          error:
            "Run reconciliation successfully before recovery.",
        },
        { status: 409 }
      );
    }

    /*
     * Require a recent reconciliation result.
     * A stale no-match must never authorize a new booking.
     */
    const reconciliationAge =
      Date.now() - orphan.lastReconciledAt;

    if (reconciliationAge > 5 * 60 * 1000) {
      return NextResponse.json(
        {
          error:
            "Reconciliation result is too old. Reconcile again before recovery.",
        },
        { status: 409 }
      );
    }

    /*
     * Check whether this session has since been finalized.
     */
    const existingFinalization = await redis.get(
      `bookeo-finalized:${sessionId}`
    );

    if (existingFinalization) {
      return NextResponse.json({
        result: "already_finalized",
      });
    }

    /*
     * Acquire an atomic recovery lock.
     */
    lockKey = `bookeo-recovery-lock:${sessionId}`;
    lockToken = crypto.randomUUID();

    const lockResult = await redis.set(
      lockKey,
      lockToken,
      {
        nx: true,
        ex: 120,
      }
    );

    if (lockResult !== "OK") {
      return NextResponse.json(
        {
          error: "Recovery is already in progress.",
        },
        { status: 409 }
      );
    }

    lockAcquired = true;

    /*
     * Re-check successful finalization after obtaining
     * the lock.
     */
    const finalizedAfterLock = await redis.get(
      `bookeo-finalized:${sessionId}`
    );

    if (finalizedAfterLock) {
      return NextResponse.json({
        result: "already_finalized",
      });
    }

    /*
     * FRESH AUTHORIZE.NET VERIFICATION
     *
     * Do not depend on the 24-hour verified-payment
     * Redis record. Ask Authorize.net directly.
     */
    const authorizeApiUrl =
      authorizeEnvironment === "sandbox"
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    const authorizeResponse = await fetch(
      authorizeApiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          getTransactionDetailsRequest: {
            merchantAuthentication: {
              name: loginId,
              transactionKey,
            },
            transId: orphan.transactionId,
          },
        }),
      }
    );

    const authorizeData =
      await authorizeResponse.json();

    if (
      !authorizeResponse.ok ||
      authorizeData?.messages?.resultCode !== "Ok" ||
      !authorizeData?.transaction
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.net transaction could not be re-verified.",
        },
        { status: 409 }
      );
    }

    const transaction = authorizeData.transaction;

    const expectedAmount = Number(orphan.amount);
    const actualAmount = Number(transaction.authAmount);

    const amountMatches =
      Number.isFinite(expectedAmount) &&
      Number.isFinite(actualAmount) &&
      Math.abs(expectedAmount - actualAmount) < 0.001;

    const referenceMatches =
      String(transaction.refId || "") === sessionId;

    const statusIsValid = [
      "capturedPendingSettlement",
      "settledSuccessfully",
    ].includes(
      String(transaction.transactionStatus || "")
    );

    if (
      !amountMatches ||
      !referenceMatches ||
      !statusIsValid
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.net payment did not pass recovery verification.",
        },
        { status: 403 }
      );
    }

    /*
     * RECONCILE BOOKEO AGAIN INSIDE THE LOCK.
     *
     * Even though reconciliation ran recently, check one
     * more time immediately before creating anything.
     */
    const startTime =
      `${orphan.date}T00:00:00-00:00`;

    const endTime =
      `${orphan.date}T23:59:59-00:00`;

    const lookupUrl =
      `https://api.bookeo.com/v2/bookings` +
      `?apiKey=${encodeURIComponent(BOOKEO_API_KEY)}` +
      `&secretKey=${encodeURIComponent(BOOKEO_SECRET_KEY)}` +
      `&startTime=${encodeURIComponent(startTime)}` +
      `&endTime=${encodeURIComponent(endTime)}` +
      `&productId=${encodeURIComponent(orphan.productId)}`;

    const lookupResponse = await fetch(lookupUrl, {
      method: "GET",
      cache: "no-store",
    });

    const lookupData = await lookupResponse.json();

    if (!lookupResponse.ok) {
      return NextResponse.json(
        {
          error:
            "Bookeo could not be checked immediately before recovery.",
        },
        { status: 502 }
      );
    }

    const bookings: BookeoBooking[] =
      Array.isArray(lookupData?.data)
        ? lookupData.data
        : [];

    const orphanPlayers = Number(orphan.players);

    const existingMatches = bookings.filter(
      (booking) => {
        if (
          booking.productId !== orphan.productId ||
          booking.eventId !== orphan.eventId ||
          booking.canceled === true
        ) {
          return false;
        }

        const adults =
          booking.participants?.numbers?.find(
            (participant) =>
              participant.peopleCategoryId === "Cadults"
          )?.number;

        const paidAmount = Number(
          booking.price?.totalPaid?.amount
        );

        return (
          Number.isFinite(adults) &&
          adults === orphanPlayers &&
          Number.isFinite(paidAmount) &&
          Math.abs(
            paidAmount - expectedAmount
          ) < 0.001
        );
      }
    );

    if (existingMatches.length > 0) {
      /*
      * A matching booking appeared after the earlier
      * reconciliation.
      *
      * This can happen if Bookeo actually accepted a previous
      * recovery/finalize request but our server crashed or lost
      * the response before recording success.
      *
      * Never create another booking. If there is exactly one
      * matching booking, record it as reconciled.
      */
      if (existingMatches.length === 1) {
        const existingBookingNumber = String(
          existingMatches[0].bookingNumber || ""
        );

        if (!existingBookingNumber) {
          return NextResponse.json(
            {
              result: "manual_review_required",
              error:
                "A matching Bookeo booking exists but has no booking number.",
            },
            { status: 409 }
          );
        }

        await redis.set(
          `bookeo-finalized:${sessionId}`,
          {
            sessionId,
            bookingId: existingBookingNumber,
            transactionId: orphan.transactionId,
            finalizedAt: Date.now(),
            reconciled: true,
          },
          {
            ex: 60 * 60 * 24 * 90,
          }
        );

        await redis.set(
          `orphan-payment:${sessionId}`,
          {
            ...orphan,
            status: "reconciled",
            reconciledBookingNumber: existingBookingNumber,
            reconciledAt: Date.now(),
          },
          {
            ex: 60 * 60 * 24 * 30,
          }
        );

        return NextResponse.json({
          result: "reconciled",
          sessionId,
          bookingNumber: existingBookingNumber,
        });
      }

      /*
      * More than one matching booking is ambiguous.
      * Never guess which booking belongs to this payment.
      */
      return NextResponse.json(
        {
          result: "manual_review_required",
          error:
            "Multiple matching Bookeo bookings exist. Recovery stopped to prevent a duplicate booking.",
          matches: existingMatches.length,
        },
        { status: 409 }
      );
    }

    /*
     * At this point:
     * - payment was freshly verified;
     * - no previous finalization exists;
     * - reconciliation recently returned no match;
     * - Bookeo was checked again inside the lock;
     * - no matching booking exists.
     *
     * Now create the recovery booking.
     *
     * We intentionally do not depend on the old hold still
     * existing because recovery may happen much later.
     */
    const createUrl =
      `https://api.bookeo.com/v2/bookings` +
      `?apiKey=${encodeURIComponent(BOOKEO_API_KEY)}` +
      `&secretKey=${encodeURIComponent(BOOKEO_SECRET_KEY)}`;

    const bookeoResponse = await fetch(createUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        productId: orphan.productId,
        eventId: orphan.eventId,

        participants: {
          numbers: [
            {
              peopleCategoryId: "Cadults",
              number: Number(orphan.players),
            },
          ],
        },

        customer: {
          firstName: orphan.firstName || "",
          lastName: orphan.lastName || "",
          emailAddress: orphan.email || "",
          phoneNumbers: orphan.phone
            ? [
                {
                  number: orphan.phone,
                  type: "mobile",
                },
              ]
            : [],
        },

        initialPayments: [
          {
            reason: "Paid online - recovered booking",
            comment:
              `Recovered from Authorize.net transaction ${orphan.transactionId}`,
            amount: {
              amount: expectedAmount.toFixed(2),
              currency: "USD",
            },
            paymentMethod: "creditCard",
          },
        ],
      }),
    });

    const bookeoData = await bookeoResponse.json();

    if (!bookeoResponse.ok) {
      await redis.set(
        `orphan-payment:${sessionId}`,
        {
          ...orphan,
          bookeoError: bookeoData,
          lastRecoveryAttemptAt: Date.now(),
        },
        {
          ex: 60 * 60 * 24 * 30,
        }
      );

      return NextResponse.json(
        {
          error:
            "Bookeo recovery booking failed.",
          bookeoStatus: bookeoResponse.status,
        },
        { status: 502 }
      );
    }

    const bookingNumber = String(
      bookeoData?.bookingNumber || ""
    );

    if (!bookingNumber) {
      return NextResponse.json(
        {
          error:
            "Bookeo reported success but returned no booking number.",
        },
        { status: 500 }
      );
    }

    await redis.set(
      `bookeo-finalized:${sessionId}`,
      {
        sessionId,
        bookingId: bookingNumber,
        transactionId: orphan.transactionId,
        finalizedAt: Date.now(),
        recovered: true,
      },
      {
        ex: 60 * 60 * 24 * 90,
      }
    );

    await redis.set(
      `orphan-payment:${sessionId}`,
      {
        ...orphan,
        status: "recovered",
        recoveredBookingNumber: bookingNumber,
        recoveredAt: Date.now(),
      },
      {
        ex: 60 * 60 * 24 * 30,
      }
    );

    return NextResponse.json({
      result: "recovered",
      sessionId,
      bookingNumber,
    });
  } catch (error) {
    console.error(
      "ORPHAN RECOVERY ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Could not recover orphan payment.",
      },
      { status: 500 }
    );
  } finally {
    if (lockAcquired && lockKey && lockToken) {
      try {
        const currentToken =
          await redis.get<string>(lockKey);

        if (currentToken === lockToken) {
          await redis.del(lockKey);
        }
      } catch (error) {
        console.error(
          "ORPHAN RECOVERY LOCK RELEASE ERROR:",
          error
        );
      }
    }
  }
}