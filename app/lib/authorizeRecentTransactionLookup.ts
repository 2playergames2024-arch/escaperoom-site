import "server-only";

import {
  findAuthorizeUnsettledTransactionByInvoiceNumber,
  getAuthorizeGatewayConfig,
} from "@/app/lib/authorizeSandbox";

export type AuthorizeRecentTransactionLookupResult =
  | {
      ok: true;
      result: "FOUND";
      transactionId: string;
      transactionStatus: string;
    }
  | {
      ok: true;
      result: "NO_MATCH";
    }
  | {
      ok: true;
      result: "AMBIGUOUS";
      matches: number;
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    };

type JsonRecord = Record<string, unknown>;

type SettledMatch = {
  transactionId: string;
  transactionStatus: string;
};

const TRANSACTION_PAGE_SIZE = 1000;

function asRecord(value: unknown): JsonRecord | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ||
    typeof value === "number"
    ? String(value).trim()
    : "";
}

async function postAuthorizeRequest(
  apiUrl: string,
  body: JsonRecord
): Promise<
  | {
      ok: true;
      data: JsonRecord;
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const response = await fetch(
      apiUrl,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(body),
        signal:
          AbortSignal.timeout(
            15_000
          ),
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        message:
          `Authorize.Net reporting request returned HTTP ${response.status}.`,
      };
    }

    const parsed: unknown =
      await response.json();

    const data =
      asRecord(parsed);

    if (!data) {
      return {
        ok: false,
        message:
          "Authorize.Net returned an invalid reporting response.",
      };
    }

    const messages =
      asRecord(data.messages);

    const resultCode =
      stringValue(
        messages?.resultCode
      );

    if (
      resultCode &&
      resultCode.toLowerCase() !== "ok"
    ) {
      return {
        ok: false,
        message:
          "Authorize.Net reporting request did not complete successfully.",
      };
    }

    return {
      ok: true,
      data,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Authorize.Net reporting request could not be completed.",
    };
  }
}

export async function findAuthorizeRecentTransactionByInvoiceNumber(
  invoiceNumber: string
): Promise<AuthorizeRecentTransactionLookupResult> {
  const normalizedInvoiceNumber =
    invoiceNumber.trim();

  if (!normalizedInvoiceNumber) {
    return {
      ok: false,
      message:
        "Authorize.Net invoice number is missing.",
      uncertain: false,
    };
  }

  /*
   * First search the normal unsettled list. This is the
   * expected location for a transaction only seconds old.
   */
  const unsettled =
    await findAuthorizeUnsettledTransactionByInvoiceNumber(
      normalizedInvoiceNumber
    );

  if (
    !unsettled.ok ||
    unsettled.result !== "NO_MATCH"
  ) {
    return unsettled;
  }

  /*
   * NO_MATCH in the unsettled list alone is not proof that
   * no transaction exists. A transaction could cross the
   * settlement boundary while the checkout is being resolved.
   * Search recently settled batches before returning NO_MATCH.
   */
  const {
    loginId,
    transactionKey,
    apiUrl,
  } = getAuthorizeGatewayConfig();

  if (
    !loginId ||
    !transactionKey
  ) {
    return {
      ok: false,
      message:
        "Authorize.Net credentials are not configured.",
      uncertain: false,
    };
  }

  const now = new Date();
  const firstSettlementDate =
    new Date(
      now.getTime() -
      48 * 60 * 60 * 1000
    );

  const batchResponse =
    await postAuthorizeRequest(
      apiUrl,
      {
        getSettledBatchListRequest: {
          merchantAuthentication: {
            name: loginId,
            transactionKey,
          },
          includeStatistics: false,
          firstSettlementDate:
            firstSettlementDate.toISOString(),
          lastSettlementDate:
            now.toISOString(),
        },
      }
    );

  if (!batchResponse.ok) {
    return {
      ok: false,
      message:
        batchResponse.message,
      uncertain: true,
    };
  }

  const batchList =
    asArray(
      batchResponse.data.batchList
    );

  const matches: SettledMatch[] = [];

  for (const batchValue of batchList) {
    const batch =
      asRecord(batchValue);

    const batchId =
      stringValue(
        batch?.batchId
      );

    if (!batchId) {
      continue;
    }

    for (
      let offset = 1;
      ;
      offset++
    ) {
      const transactionResponse =
        await postAuthorizeRequest(
          apiUrl,
          {
            getTransactionListRequest: {
              merchantAuthentication: {
                name: loginId,
                transactionKey,
              },
              batchId,
              sorting: {
                orderBy:
                  "submitTimeUTC",
                orderDescending:
                  true,
              },
              paging: {
                limit:
                  TRANSACTION_PAGE_SIZE,
                offset,
              },
            },
          }
        );

      if (!transactionResponse.ok) {
        return {
          ok: false,
          message:
            transactionResponse.message,
          uncertain: true,
        };
      }

      const transactions =
        asArray(
          transactionResponse.data.transactions
        );

      for (
        const transactionValue
        of transactions
      ) {
        const transaction =
          asRecord(
            transactionValue
          );

        if (!transaction) {
          continue;
        }

        if (
          stringValue(
            transaction.invoiceNumber
          ) !== normalizedInvoiceNumber
        ) {
          continue;
        }

        const transactionId =
          stringValue(
            transaction.transId
          );

        if (!transactionId) {
          continue;
        }

        matches.push({
          transactionId,
          transactionStatus:
            stringValue(
              transaction.transactionStatus
            ),
        });

        if (matches.length > 1) {
          return {
            ok: true,
            result: "AMBIGUOUS",
            matches:
              matches.length,
          };
        }
      }

      if (
        transactions.length <
        TRANSACTION_PAGE_SIZE
      ) {
        break;
      }
    }
  }

  if (matches.length === 0) {
    return {
      ok: true,
      result: "NO_MATCH",
    };
  }

  if (matches.length > 1) {
    return {
      ok: true,
      result: "AMBIGUOUS",
      matches:
        matches.length,
    };
  }

  return {
    ok: true,
    result: "FOUND",
    transactionId:
      matches[0].transactionId,
    transactionStatus:
      matches[0].transactionStatus,
  };
}
