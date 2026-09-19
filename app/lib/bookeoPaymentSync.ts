import "server-only";

import { randomUUID } from "crypto";
import { Redis } from "@upstash/redis";

import {
  logBookingEvent,
} from "@/app/lib/bookingLog";

const redis = Redis.fromEnv();

const BOOKEO_KOP_API_KEY =
  process.env.BOOKEO_KOP_API_KEY;
const BOOKEO_CH_API_KEY =
  process.env.BOOKEO_CH_API_KEY;
const BOOKEO_SECRET_KEY =
  process.env.BOOKEO_SECRET_KEY;

const BOOKEO_TIMEOUT_MS = 15_000;
const PAYMENT_SYNC_LOCK_SECONDS = 60;

type BookeoPayment = {
  id?: string;
  comment?: string;
  amount?: {
    amount?: string | number;
    currency?: string;
  };
};

type BookeoPaymentsPage = {
  data?: BookeoPayment[];
  info?: {
    totalPages?: number;
    pageNavigationToken?: string;
  };
};

type BookeoAccount = {
  name: "KOP" | "CH";
  apiKey: string;
};

export type BookeoPaymentSyncResult =
  | {
      ok: true;
      alreadyRecorded: boolean;
      paymentId: string | null;
      account: "KOP" | "CH";
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    };

function getBookeoAccounts(): BookeoAccount[] {
  const accounts: BookeoAccount[] = [];

  if (BOOKEO_KOP_API_KEY) {
    accounts.push({
      name: "KOP",
      apiKey: BOOKEO_KOP_API_KEY,
    });
  }

  if (BOOKEO_CH_API_KEY) {
    accounts.push({
      name: "CH",
      apiKey: BOOKEO_CH_API_KEY,
    });
  }

  return accounts;
}

function paymentAmount(
  payment: BookeoPayment
) {
  const value = Number(
    payment.amount?.amount
  );

  return Number.isFinite(value)
    ? value
    : null;
}

function paymentMatches({
  payment,
  transactionId,
  amount,
}: {
  payment: BookeoPayment;
  transactionId: string;
  amount: number;
}) {
  const comment =
    String(
      payment.comment || ""
    ).toLowerCase();

  const expectedTransaction =
    transactionId.toLowerCase();

  const existingAmount =
    paymentAmount(payment);

  return (
    comment.includes(
      expectedTransaction
    ) &&
    existingAmount !== null &&
    Math.abs(
      existingAmount - amount
    ) < 0.005
  );
}

async function getPaymentsPage({
  account,
  bookingNumber,
  pageNavigationToken,
  pageNumber,
}: {
  account: BookeoAccount;
  bookingNumber: string;
  pageNavigationToken?: string;
  pageNumber?: number;
}) {
  const query =
    pageNavigationToken
      ? `?pageNavigationToken=${encodeURIComponent(
          pageNavigationToken
        )}&pageNumber=${pageNumber || 1}`
      : "?itemsPerPage=100";

  const response =
    await fetch(
      `https://api.bookeo.com/v2/bookings/${encodeURIComponent(
        bookingNumber
      )}/payments${query}`,
      {
        method: "GET",
        cache: "no-store",
        signal:
          AbortSignal.timeout(
            BOOKEO_TIMEOUT_MS
          ),
        headers: {
          "X-Bookeo-apiKey":
            account.apiKey,
          "X-Bookeo-secretKey":
            BOOKEO_SECRET_KEY || "",
        },
      }
    );

  let data: BookeoPaymentsPage | null =
    null;

  try {
    data =
      await response.json();
  } catch {
    data = null;
  }

  return {
    response,
    data,
  };
}

async function findBookingAccountAndPayments(
  bookingNumber: string
): Promise<
  | {
      ok: true;
      account: BookeoAccount;
      payments: BookeoPayment[];
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    }
> {
  if (!BOOKEO_SECRET_KEY) {
    return {
      ok: false,
      message:
        "BOOKEO_SECRET_KEY is not configured.",
      uncertain: false,
    };
  }

  const accounts =
    getBookeoAccounts();

  if (accounts.length === 0) {
    return {
      ok: false,
      message:
        "Bookeo API keys are not configured.",
      uncertain: false,
    };
  }

  let sawUncertainFailure = false;

  for (const account of accounts) {
    try {
      const first =
        await getPaymentsPage({
          account,
          bookingNumber,
        });

      if (!first.response.ok) {
        if (
          first.response.status >= 500
        ) {
          sawUncertainFailure = true;
        }

        continue;
      }

      const payments = [
        ...(first.data?.data || []),
      ];

      const totalPages =
        Math.max(
          1,
          Number(
            first.data?.info
              ?.totalPages || 1
          )
        );

      const token =
        String(
          first.data?.info
            ?.pageNavigationToken || ""
        );

      if (
        totalPages > 1 &&
        token
      ) {
        for (
          let pageNumber = 2;
          pageNumber <= totalPages;
          pageNumber++
        ) {
          const page =
            await getPaymentsPage({
              account,
              bookingNumber,
              pageNavigationToken:
                token,
              pageNumber,
            });

          if (!page.response.ok) {
            return {
              ok: false,
              message:
                "Bookeo payment history could not be read completely.",
              uncertain:
                page.response.status >=
                500,
            };
          }

          payments.push(
            ...(page.data?.data || [])
          );
        }
      }

      return {
        ok: true,
        account,
        payments,
      };
    } catch {
      sawUncertainFailure = true;
    }
  }

  return {
    ok: false,
    message:
      "The Bookeo booking account could not be identified or its payments could not be read.",
    uncertain:
      sawUncertainFailure,
  };
}

async function releaseLock(
  lockKey: string,
  lockToken: string
) {
  const current =
    await redis.get<string>(
      lockKey
    );

  if (current === lockToken) {
    await redis.del(lockKey);
  }
}

export async function ensureBookeoPaymentRecorded({
  checkoutId,
  bookingNumber,
  transactionId,
  amount,
}: {
  checkoutId: string;
  bookingNumber: string;
  transactionId: string;
  amount: number;
}): Promise<BookeoPaymentSyncResult> {
  if (
    !bookingNumber ||
    !transactionId ||
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return {
      ok: false,
      message:
        "Bookeo payment sync received invalid booking/payment data.",
      uncertain: false,
    };
  }

  const lockKey =
    `bookeo-payment-sync:${bookingNumber}:${transactionId}`;
  const lockToken =
    randomUUID();

  const claimed =
    await redis.set(
      lockKey,
      lockToken,
      {
        nx: true,
        ex:
          PAYMENT_SYNC_LOCK_SECONDS,
      }
    );

  if (claimed !== "OK") {
    return {
      ok: false,
      message:
        "Another Bookeo payment sync is already in progress.",
      uncertain: true,
    };
  }

  try {
    const accountLookup =
      await findBookingAccountAndPayments(
        bookingNumber
      );

    if (accountLookup.ok === false) {
      return {
        ok: false,
        message:
          accountLookup.message,
        uncertain:
          accountLookup.uncertain,
      };
    }

    const existing =
      accountLookup.payments.find(
        (payment) =>
          paymentMatches({
            payment,
            transactionId,
            amount,
          })
      );

    if (existing) {
      logBookingEvent(
        "bookeo.payment_sync_already_recorded",
        {
          checkoutId,
          authorizeTransactionId:
            transactionId,
          bookeoBookingId:
            bookingNumber,
          result:
            accountLookup.account.name,
        }
      );

      return {
        ok: true,
        alreadyRecorded: true,
        paymentId:
          existing.id || null,
        account:
          accountLookup.account.name,
      };
    }

    const transactionComment =
      `Authorize.Net transaction ${transactionId}`;

    const response =
      await fetch(
        `https://api.bookeo.com/v2/bookings/${encodeURIComponent(
          bookingNumber
        )}/payments`,
        {
          method: "POST",
          cache: "no-store",
          signal:
            AbortSignal.timeout(
              BOOKEO_TIMEOUT_MS
            ),
          headers: {
            "Content-Type":
              "application/json",
            "X-Bookeo-apiKey":
              accountLookup.account
                .apiKey,
            "X-Bookeo-secretKey":
              BOOKEO_SECRET_KEY || "",
          },
          body: JSON.stringify({
            receivedTime:
              new Date().toISOString(),
            reason:
              "Paid online",
            comment:
              transactionComment,
            amount: {
              amount:
                amount.toFixed(2),
              currency: "USD",
            },
            paymentMethod:
              "creditCard",
          }),
        }
      );

    let data:
      | {
          id?: string;
          message?: string;
          errorId?: string;
        }
      | null = null;

    try {
      data =
        await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      logBookingEvent(
        "bookeo.payment_sync_failed",
        {
          checkoutId,
          authorizeTransactionId:
            transactionId,
          bookeoBookingId:
            bookingNumber,
          result:
            String(
              response.status
            ),
          errorCode:
            "BOOKEO_PAYMENT_SYNC_FAILED",
          metadata: {
            bookeoMessage:
              data?.message || null,
            bookeoErrorId:
              data?.errorId || null,
          },
        },
        "warn"
      );

      return {
        ok: false,
        message:
          data?.message ||
          `Bookeo payment recording returned HTTP ${response.status}.`,
        uncertain:
          response.status >= 500,
      };
    }

    logBookingEvent(
      "bookeo.payment_sync_succeeded",
      {
        checkoutId,
        authorizeTransactionId:
          transactionId,
        bookeoBookingId:
          bookingNumber,
        result:
          accountLookup.account.name,
      }
    );

    return {
      ok: true,
      alreadyRecorded: false,
      paymentId:
        data?.id || null,
      account:
        accountLookup.account.name,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Bookeo payment sync failed.",
      uncertain: true,
    };
  } finally {
    try {
      await releaseLock(
        lockKey,
        lockToken
      );
    } catch {
      // The lock has a short TTL; cleanup failure is non-fatal.
    }
  }
}
