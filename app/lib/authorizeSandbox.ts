import "server-only";

export type AuthorizeEnvironment =
  | "sandbox"
  | "production";

export function getAuthorizeEnvironment(): AuthorizeEnvironment {
  return process.env.AUTHORIZE_ENVIRONMENT ===
    "production"
    ? "production"
    : "sandbox";
}

export function getAuthorizeGatewayConfig() {
  const environment =
    getAuthorizeEnvironment();

  const production =
    environment === "production";

  const loginId = production
    ? process.env.AUTHORIZE_LOGIN_ID
    : process.env.AUTHORIZE_SANDBOX_LOGIN_ID;

  const transactionKey = production
    ? process.env.AUTHORIZE_TRANSACTION_KEY
    : process.env.AUTHORIZE_SANDBOX_TRANSACTION_KEY;

  const signatureKey = production
    ? process.env.AUTHORIZE_SIGNATURE_KEY
    : process.env.AUTHORIZE_SANDBOX_SIGNATURE_KEY;

  return {
    environment,
    loginId,
    transactionKey,
    signatureKey,
    apiUrl: production
      ? "https://api.authorize.net/xml/v1/request.api"
      : "https://apitest.authorize.net/xml/v1/request.api",
  };
}

export type AuthorizeInvoiceLookupResult =
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

export async function findAuthorizeUnsettledTransactionByInvoiceNumber(
  invoiceNumber: string
): Promise<AuthorizeInvoiceLookupResult> {
  const {
    loginId,
    transactionKey,
    apiUrl,
    environment,
  } = getAuthorizeGatewayConfig();

  if (
    !loginId ||
    !transactionKey
  ) {
    return {
      ok: false,
      message:
        `Authorize.Net ${environment} credentials are not configured.`,
      uncertain: false,
    };
  }

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

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            getUnsettledTransactionListRequest: {
              merchantAuthentication: {
                name:
                  loginId,
                transactionKey:
                  transactionKey,
              },
              sorting: {
                orderBy:
                  "submitTimeUTC",
                orderDescending:
                  true,
              },
              paging: {
                limit: 1000,
                offset: 1,
              },
            },
          }),
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
          "Authorize.Net could not list unsettled transactions.",
        uncertain: true,
      };
    }

    const data =
      await response.json();

    const transactions =
      Array.isArray(data?.transactions)
        ? data.transactions
        : [];

    const matches =
      transactions.filter(
        (transaction: any) =>
          String(
            transaction?.invoiceNumber ||
            ""
          ).trim() ===
          normalizedInvoiceNumber
      );

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

    const transactionId =
      String(
        matches[0]?.transId ||
        ""
      ).trim();

    if (
      !transactionId ||
      transactionId === "0"
    ) {
      return {
        ok: false,
        message:
          "Authorize.Net found the invoice but did not return a usable transaction ID.",
        uncertain: true,
      };
    }

    return {
      ok: true,
      result: "FOUND",
      transactionId,
      transactionStatus:
        String(
          matches[0]?.transactionStatus ||
          ""
        ),
    };
  } catch {
    return {
      ok: false,
      message:
        "Authorize.Net could not confirm the unsettled transaction list.",
      uncertain: true,
    };
  }
}

export type VoidAuthorizationResult =
  | {
      ok: true;
      transactionId: string;
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    };

export async function voidAuthorizeAuthorization(
  transactionId: string
): Promise<VoidAuthorizationResult> {
  const {
    loginId,
    transactionKey,
    apiUrl,
    environment,
  } = getAuthorizeGatewayConfig();

  if (
    !loginId ||
    !transactionKey
  ) {
    return {
      ok: false,
      message:
        `Authorize.Net ${environment} credentials are not configured.`,
      uncertain: false,
    };
  }

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            createTransactionRequest: {
              merchantAuthentication: {
                name:
                  loginId,
                transactionKey:
                  transactionKey,
              },
              transactionRequest: {
                transactionType:
                  "voidTransaction",
                refTransId:
                  transactionId,
              },
            },
          }),
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
          "Authorize.Net did not confirm the void.",
        uncertain: true,
      };
    }

    const data =
      await response.json();

    const transactionResponse =
      data?.transactionResponse;

    const responseCode =
      String(
        transactionResponse
          ?.responseCode || ""
      );

    const voidTransactionId =
      String(
        transactionResponse
          ?.transId ||
        transactionId
      );

    const message =
      String(
        transactionResponse
          ?.messages?.[0]
          ?.description ||
        transactionResponse
          ?.errors?.[0]
          ?.errorText ||
        data
          ?.messages?.message?.[0]
          ?.text ||
        "Authorize.Net did not confirm the void."
      );

    if (responseCode === "1") {
      return {
        ok: true,
        transactionId:
          voidTransactionId,
      };
    }

    return {
      ok: false,
      message,
      uncertain: false,
    };
  } catch {
    return {
      ok: false,
      message:
        "Authorize.Net did not confirm the void.",
      uncertain: true,
    };
  }
}

export type CaptureAuthorizationResult =
  | {
      ok: true;
      transactionId: string;
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    };

export async function captureAuthorizeAuthorization(
  transactionId: string,
  amount: number
): Promise<CaptureAuthorizationResult> {
  const {
    loginId,
    transactionKey,
    apiUrl,
    environment,
  } = getAuthorizeGatewayConfig();

  if (
    !loginId ||
    !transactionKey
  ) {
    return {
      ok: false,
      message:
        `Authorize.Net ${environment} credentials are not configured.`,
      uncertain: false,
    };
  }

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            createTransactionRequest: {
              merchantAuthentication: {
                name:
                  loginId,
                transactionKey:
                  transactionKey,
              },
              transactionRequest: {
                transactionType:
                  "priorAuthCaptureTransaction",
                amount:
                  amount.toFixed(2),
                refTransId:
                  transactionId,
              },
            },
          }),
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
          "Authorize.Net did not return a confirmed capture result.",
        uncertain: true,
      };
    }

    const data =
      await response.json();

    const transactionResponse =
      data?.transactionResponse;

    const responseCode =
      String(
        transactionResponse
          ?.responseCode || ""
      );

    const captureTransactionId =
      String(
        transactionResponse
          ?.transId ||
        transactionId
      );

    const message =
      String(
        transactionResponse
          ?.messages?.[0]
          ?.description ||
        transactionResponse
          ?.errors?.[0]
          ?.errorText ||
        data
          ?.messages?.message?.[0]
          ?.text ||
        "Authorize.Net did not confirm the capture."
      );

    if (responseCode === "1") {
      return {
        ok: true,
        transactionId:
          captureTransactionId,
      };
    }

    return {
      ok: false,
      message,
      uncertain: false,
    };
  } catch {
    return {
      ok: false,
      message:
        "Authorize.Net did not return a confirmed capture result.",
      uncertain: true,
    };
  }
}

export type AuthorizeTransactionStateResult =
  | {
      ok: true;
      transactionId: string;
      status: string;
      authorizedAmount: number | null;
      settledAmount: number | null;
    }
  | {
      ok: false;
      message: string;
      uncertain: boolean;
    };

export async function getAuthorizeTransactionState(
  transactionId: string
): Promise<AuthorizeTransactionStateResult> {
  const {
    loginId,
    transactionKey,
    apiUrl,
    environment,
  } = getAuthorizeGatewayConfig();

  if (
    !loginId ||
    !transactionKey
  ) {
    return {
      ok: false,
      message:
        `Authorize.Net ${environment} credentials are not configured.`,
      uncertain: false,
    };
  }

  try {
    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            getTransactionDetailsRequest: {
              merchantAuthentication: {
                name:
                  loginId,
                transactionKey:
                  transactionKey,
              },
              transId:
                transactionId,
            },
          }),
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
          "Authorize.Net did not return transaction details.",
        uncertain: true,
      };
    }

    const data =
      await response.json();

    const transaction =
      data?.transaction;

    const status =
      String(
        transaction
          ?.transactionStatus || ""
      );

    const returnedTransactionId =
      String(
        transaction?.transId ||
        transactionId
      );

    if (!transaction || !status) {
      const message =
        String(
          data
            ?.messages?.message?.[0]
            ?.text ||
          "Authorize.Net did not return a usable transaction status."
        );

      return {
        ok: false,
        message,
        uncertain: false,
      };
    }

    const authAmount =
      Number(
        transaction?.authAmount
      );

    const settleAmount =
      Number(
        transaction?.settleAmount
      );

    return {
      ok: true,
      transactionId:
        returnedTransactionId,
      status,
      authorizedAmount:
        Number.isFinite(authAmount)
          ? authAmount
          : null,
      settledAmount:
        Number.isFinite(settleAmount)
          ? settleAmount
          : null,
    };
  } catch {
    return {
      ok: false,
      message:
        "Authorize.Net transaction status could not be confirmed.",
      uncertain: true,
    };
  }
}

// Backward-compatible aliases for any older imports that
// have not yet been renamed.
export const findSandboxUnsettledTransactionByInvoiceNumber =
  findAuthorizeUnsettledTransactionByInvoiceNumber;
export const voidSandboxAuthorization =
  voidAuthorizeAuthorization;
export const captureSandboxAuthorization =
  captureAuthorizeAuthorization;
export const getSandboxTransactionState =
  getAuthorizeTransactionState;
export type SandboxInvoiceLookupResult =
  AuthorizeInvoiceLookupResult;
export type SandboxTransactionStateResult =
  AuthorizeTransactionStateResult;
