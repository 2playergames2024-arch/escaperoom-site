import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import {
  type BookingSession,
  isValidBookingSessionId,
} from "@/app/lib/booking";
import {
  claimCheckoutForAuthorization,
  updateBookingLedgerRecord,
} from "@/app/lib/bookingLedger";
import {
  BOOKING_STATES,
} from "@/app/lib/bookingState";
import {
  ensurePreAuthHold,
} from "@/app/lib/preAuthHold";
import {
  voidSandboxAuthorization,
} from "@/app/lib/authorizeSandbox";

const redis = Redis.fromEnv();

const AUTHORIZE_SANDBOX_LOGIN_ID =
  process.env.AUTHORIZE_SANDBOX_LOGIN_ID;

const AUTHORIZE_SANDBOX_TRANSACTION_KEY =
  process.env.AUTHORIZE_SANDBOX_TRANSACTION_KEY;

const AUTHORIZE_SANDBOX_URL =
  "https://apitest.authorize.net/xml/v1/request.api";

type OpaqueData = {
  dataDescriptor: string;
  dataValue: string;
};

export async function POST(
  request: NextRequest
) {
  try {
    if (
      !AUTHORIZE_SANDBOX_LOGIN_ID ||
      !AUTHORIZE_SANDBOX_TRANSACTION_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.Net sandbox credentials are not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const body =
      await request.json();

    const sessionId =
      String(body.sessionId || "");

    const opaqueData =
      body.opaqueData as OpaqueData | undefined;

    if (!isValidBookingSessionId(sessionId)) {
      return NextResponse.json(
        {
          error:
            "The booking session is invalid or expired.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !opaqueData ||
      opaqueData.dataDescriptor !==
      "COMMON.ACCEPT.INAPP.PAYMENT" ||
      !opaqueData.dataValue
    ) {
      return NextResponse.json(
        {
          error:
            "The secure payment token is invalid.",
        },
        {
          status: 400,
        }
      );
    }

    let session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "The booking session could not be found or has expired.",
        },
        {
          status: 410,
        }
      );
    }

    /*
     * STEP 15:
     * Verify the current Bookeo hold before any
     * Authorize.Net authorization is attempted.
     */
    const preAuthHoldResult =
      await ensurePreAuthHold(session);

    if (!preAuthHoldResult.ok) {
      if (
        preAuthHoldResult.reason ===
        "UNAVAILABLE"
      ) {
        return NextResponse.json(
          {
            error:
              "Sorry, those seats are no longer available.",
            unavailable: true,
          },
          {
            status: 409,
          }
        );
      }

      return NextResponse.json(
        {
          error:
            "Bookeo could not verify the booking hold. Please try again.",
        },
        {
          status: 502,
        }
      );
    }

    session =
      preAuthHoldResult.session;

    /*
     * STEP 17:
     * Atomic server-side payment-attempt lock.
     *
     * Exactly one request can move this checkout
     * from HOLD_CREATED to AUTHORIZING.
     */
    const claimedCheckout =
      await claimCheckoutForAuthorization(
        session.checkoutId
      );

    if (!claimedCheckout) {
      return NextResponse.json(
        {
          error:
            "This payment attempt has already been started.",
        },
        {
          status: 409,
        }
      );
    }

    const amount =
      Number(session.total);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        status:
          BOOKING_STATES.FAILED,
        errorCode:
          "INVALID_AMOUNT",
        errorMessage:
          "Trusted booking amount was invalid.",
      });

      return NextResponse.json(
        {
          error:
            "The booking total is invalid.",
        },
        {
          status: 500,
        }
      );
    }

    /*
     * STEP 18:
     * AUTH-ONLY.
     *
     * No capture occurs here.
     */
    const authorizeRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name:
            AUTHORIZE_SANDBOX_LOGIN_ID,
          transactionKey:
            AUTHORIZE_SANDBOX_TRANSACTION_KEY,
        },

        refId:
          session.checkoutId.slice(
            0,
            20
          ),

        transactionRequest: {
          transactionType:
            "authOnlyTransaction",

          amount:
            amount.toFixed(2),

          payment: {
            opaqueData: {
              dataDescriptor:
                opaqueData.dataDescriptor,
              dataValue:
                opaqueData.dataValue,
            },
          },
        },
      },
    };

    const authorizeResponse =
      await fetch(
        AUTHORIZE_SANDBOX_URL,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            authorizeRequest
          ),
          signal:
            AbortSignal.timeout(
              15_000
            ),
        }
      );

    if (!authorizeResponse.ok) {
      /*
       * We do NOT automatically retry here.
       *
       * Once AUTH-ONLY was sent, an uncertain
       * network result must not cause a second
       * authorization attempt.
       */
      return NextResponse.json(
        {
          error:
            "Authorize.Net did not return a confirmed result.",
          uncertain: true,
        },
        {
          status: 502,
        }
      );
    }

    const authorizeData =
      await authorizeResponse.json();

    const transactionResponse =
      authorizeData
        ?.transactionResponse;

    const responseCode =
      String(
        transactionResponse
          ?.responseCode || ""
      );

    const transactionId =
      String(
        transactionResponse
          ?.transId || ""
      );

    const transactionMessage =
      String(
        transactionResponse
          ?.messages?.[0]
          ?.description ||
        transactionResponse
          ?.errors?.[0]
          ?.errorText ||
        authorizeData
          ?.messages?.message?.[0]
          ?.text ||
        ""
      );

    /*
     * responseCode 1 = approved.
     */
    if (
      responseCode === "1" &&
      transactionId &&
      transactionId !== "0"
    ) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        authorizeTransactionId:
          transactionId,
        status:
          BOOKING_STATES.AUTHORIZED,
      });

      /*
       * STEP 19:
       * Authorization succeeded.
       *
       * Check the Bookeo hold again before
       * attempting final Bookeo creation.
       */
      const postAuthHoldResult =
        await ensurePreAuthHold(
          session
        );

      if (!postAuthHoldResult.ok) {
        /*
         * Bookeo explicitly says the seats
         * are no longer available.
         *
         * The authorization must be voided.
         */
        if (
          postAuthHoldResult.reason ===
          "UNAVAILABLE"
        ) {
          const voidResult =
            await voidSandboxAuthorization(
              transactionId
            );

          if (voidResult.ok) {
            await updateBookingLedgerRecord({
              checkoutId:
                session.checkoutId,
              status:
                BOOKING_STATES.VOIDED,
              errorCode:
                "POST_AUTH_HOLD_UNAVAILABLE",
              errorMessage:
                "Bookeo seats became unavailable after authorization.",
            });

            return NextResponse.json(
              {
                authorized: false,
                voided: true,
                unavailable: true,
                error:
                  "Sorry, those seats are no longer available. The card authorization was voided.",
              },
              {
                status: 409,
              }
            );
          }

          /*
           * We know the seats are unavailable,
           * but we could not confirm the void.
           *
           * Keep the ledger AUTHORIZED so
           * recovery can deal with the real
           * gateway state.
           */
          await updateBookingLedgerRecord({
            checkoutId:
              session.checkoutId,
            errorCode:
              "POST_AUTH_VOID_NOT_CONFIRMED",
            errorMessage:
              voidResult.message,
            errorData: {
              authorizeTransactionId:
                transactionId,
              uncertain:
                voidResult.uncertain,
            },
          });

          return NextResponse.json(
            {
              authorized: true,
              recoveryRequired: true,
              error:
                "The seats are no longer available, and the payment authorization requires recovery.",
            },
            {
              status: 502,
            }
          );
        }

        /*
         * Bookeo did not give us a definitive
         * availability result.
         *
         * Do NOT void and do NOT authorize again.
         * Preserve AUTHORIZED for recovery.
         */
        await updateBookingLedgerRecord({
          checkoutId:
            session.checkoutId,
          errorCode:
            "POST_AUTH_BOOKEO_ERROR",
          errorMessage:
            "Bookeo could not confirm the hold after authorization.",
          errorData: {
            authorizeTransactionId:
              transactionId,
          },
        });

        return NextResponse.json(
          {
            authorized: true,
            recoveryRequired: true,
            error:
              "The card was authorized, but the booking hold could not be confirmed.",
          },
          {
            status: 502,
          }
        );
      }

      /*
       * The hold is valid, or a replacement
       * hold was successfully created.
       */
      session =
        postAuthHoldResult.session;

      return NextResponse.json({
        authorized: true,
        transactionId,
        postAuthHoldValid: true,
        holdReplaced:
          postAuthHoldResult.replaced,
      });
    }

    /*
     * responseCode 2 or 3 is an explicit
     * decline/error result from Authorize.Net.
     *
     * No Bookeo booking is created.
     */
    if (
      responseCode === "2" ||
      responseCode === "3"
    ) {
      await updateBookingLedgerRecord({
        checkoutId:
          session.checkoutId,
        status:
          BOOKING_STATES.FAILED,
        errorCode:
          `AUTHORIZE_${responseCode}`,
        errorMessage:
          transactionMessage ||
          "Authorize.Net declined the authorization.",
        errorData: {
          responseCode,
        },
      });

      return NextResponse.json(
        {
          authorized: false,
          declined: true,
          error:
            transactionMessage ||
            "The card was declined.",
        },
        {
          status: 402,
        }
      );
    }

    /*
     * Anything else is ambiguous.
     * Leave the ledger AUTHORIZING so we do not
     * accidentally send another authorization.
     */
    return NextResponse.json(
      {
        error:
          "Authorize.Net did not return a confirmed authorization result.",
        uncertain: true,
      },
      {
        status: 502,
      }
    );
  } catch (error) {
    console.error(
      "Authorize.Net AUTH-ONLY failed.",
      error
    );

    return NextResponse.json(
      {
        error:
          "We could not confirm the payment authorization.",
        uncertain: true,
      },
      {
        status: 502,
      }
    );
  }
}