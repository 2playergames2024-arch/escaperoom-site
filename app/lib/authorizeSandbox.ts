import "server-only";

const AUTHORIZE_SANDBOX_LOGIN_ID =
  process.env.AUTHORIZE_SANDBOX_LOGIN_ID;

const AUTHORIZE_SANDBOX_TRANSACTION_KEY =
  process.env.AUTHORIZE_SANDBOX_TRANSACTION_KEY;

const AUTHORIZE_SANDBOX_URL =
  "https://apitest.authorize.net/xml/v1/request.api";

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

export async function voidSandboxAuthorization(
  transactionId: string
): Promise<VoidAuthorizationResult> {
  if (
    !AUTHORIZE_SANDBOX_LOGIN_ID ||
    !AUTHORIZE_SANDBOX_TRANSACTION_KEY
  ) {
    return {
      ok: false,
      message:
        "Authorize.Net sandbox credentials are not configured.",
      uncertain: false,
    };
  }

  try {
    const response =
      await fetch(
        AUTHORIZE_SANDBOX_URL,
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
                  AUTHORIZE_SANDBOX_LOGIN_ID,
                transactionKey:
                  AUTHORIZE_SANDBOX_TRANSACTION_KEY,
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

export async function captureSandboxAuthorization(
  transactionId: string,
  amount: number
): Promise<CaptureAuthorizationResult> {
  if (
    !AUTHORIZE_SANDBOX_LOGIN_ID ||
    !AUTHORIZE_SANDBOX_TRANSACTION_KEY
  ) {
    return {
      ok: false,
      message:
        "Authorize.Net sandbox credentials are not configured.",
      uncertain: false,
    };
  }

  try {
    const response =
      await fetch(
        AUTHORIZE_SANDBOX_URL,
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
                  AUTHORIZE_SANDBOX_LOGIN_ID,
                transactionKey:
                  AUTHORIZE_SANDBOX_TRANSACTION_KEY,
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
