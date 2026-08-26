import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import { LOCATIONS } from "../../../data/locations";
import {
  type BookingSession,
  type TrustedBookeoHold,
  type PaymentAttempt,
  type VerifiedPayment,
  type FinalizedBooking,
  isValidBookingSessionId,
} from "../../../lib/booking";
import {
  BOOKING_TEST_COOKIE_NAME,
  isValidBookingTestCookie,
} from "../../../lib/bookingTestAccess";

const redis = Redis.fromEnv();

const AUTHORIZE_TIMEOUT_MS = 15_000;
const PAYMENT_ATTEMPT_TTL_SECONDS =
  60 * 60 * 24 * 30;
const HOSTED_TOKEN_REUSE_MS =
  14 * 60 * 1000;

export async function POST(req: Request) {
  const BOOKING_TEMPORARILY_DISABLED =
    process.env.BOOKING_TEMPORARILY_DISABLED === "true";

  const cookieStore =
    await cookies();

  const hasStaffAccess =
    isValidBookingTestCookie(
      cookieStore.get(
        BOOKING_TEST_COOKIE_NAME
      )?.value
    );

  if (
    BOOKING_TEMPORARILY_DISABLED &&
    !hasStaffAccess
  ) {
    return NextResponse.json(
      {
        error:
          "Online booking is temporarily unavailable. Please contact Escape Room Mystery for assistance.",
      },
      { status: 503 }
    );
  }

  const forwardedFor =
    req.headers.get("x-forwarded-for");

  const ip =
    forwardedFor?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rateLimitKey =
    `rate-limit:hosted-payment:${ip}`;

  const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      600
    );

  if (attempts > 5) {
    return NextResponse.json(
      {
        error:
          "Too many payment attempts. Please wait a few minutes and try again.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": "600",
        },
      }
    );
  }

  let paymentAttemptKey = "";
  let paymentAttemptClaimId = "";
  let paymentAttemptClaimed = false;

  try {
    const body =
      await req.json();

    const sessionId =
      String(
        body.sessionId || ""
      ).trim();

    if (
      !isValidBookingSessionId(
        sessionId
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Missing booking session.",
        },
        { status: 400 }
      );
    }

    const loginId =
      process.env.AUTHORIZE_LOGIN_ID;

    const transactionKey =
      process.env
        .AUTHORIZE_TRANSACTION_KEY;

    const environment =
      process.env
        .AUTHORIZE_ENVIRONMENT ||
      "production";

    const siteUrl =
      process.env.SITE_URL;

    if (!siteUrl) {
      return NextResponse.json(
        {
          error:
            "SITE_URL is not configured.",
        },
        { status: 500 }
      );
    }

    if (
      !loginId ||
      !transactionKey
    ) {
      return NextResponse.json(
        {
          error:
            "Authorize.net credentials are missing.",
        },
        { status: 500 }
      );
    }

    /*
     * The browser supplies only sessionId.
     * Everything else comes from trusted Redis data.
     */
    const session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Booking session could not be verified. Please start your booking again.",
        },
        { status: 400 }
      );
    }

    if (
      session.sessionId !==
      sessionId
    ) {
      return NextResponse.json(
        {
          error:
            "Booking session could not be verified.",
        },
        { status: 400 }
      );
    }

    /*
     * Verify the underlying trusted Bookeo hold.
     */
    const trustedHold =
      await redis.get<TrustedBookeoHold>(
        `bookeo-hold:${session.holdId}`
      );

    if (!trustedHold) {
      return NextResponse.json(
        {
          error:
            "The Bookeo hold for this booking has expired. Please select your room and time again.",
        },
        { status: 400 }
      );
    }

    if (
      trustedHold.holdId !==
      session.holdId ||
      trustedHold.productId !==
      session.productId ||
      trustedHold.eventId !==
      session.eventId ||
      trustedHold.players !==
      session.players ||
      trustedHold.location !==
      session.location ||
      trustedHold.total !==
      session.total
    ) {
      return NextResponse.json(
        {
          error:
            "Booking information could not be verified. Please select your room and time again.",
        },
        { status: 400 }
      );
    }

    /*
     * Verify this hold is still owned by this session.
     */
    const mappedSessionId =
      await redis.get<string>(
        `booking-session-for-hold:${session.holdId}`
      );

    if (
      mappedSessionId !==
      sessionId
    ) {
      return NextResponse.json(
        {
          error:
            "Booking session ownership could not be verified.",
        },
        { status: 409 }
      );
    }

    const amount =
      Number(session.total);

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid verified payment amount.",
        },
        { status: 500 }
      );
    }

    if (
      session.location !==
      LOCATIONS.kingOfPrussia.slug &&
      session.location !==
      LOCATIONS.cherryHill.slug
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid booking location.",
        },
        { status: 400 }
      );
    }

    const isSandbox =
      environment ===
      "sandbox";

    const apiUrl =
      isSandbox
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    const paymentUrl =
      isSandbox
        ? "https://test.authorize.net/payment/payment"
        : "https://accept.authorize.net/payment/payment";

    /*
     * One booking session gets one Accept Hosted
     * payment attempt. Reuse the still-valid token
     * rather than creating another payable form.
     */
    const finalizedBooking =
      await redis.get<FinalizedBooking>(
        `bookeo-finalized:${sessionId}`
      );

    if (finalizedBooking) {
      return NextResponse.json(
        {
          error:
            "This booking has already been finalized.",
          alreadyFinalized:
            true,
        },
        { status: 409 }
      );
    }

    const verifiedPayment =
      await redis.get<VerifiedPayment>(
        `verified-payment:${sessionId}`
      );

    if (verifiedPayment) {
      return NextResponse.json(
        {
          error:
            "Payment has already been received for this booking. Continue to confirmation.",
          paymentReceived:
            true,
        },
        { status: 409 }
      );
    }

    paymentAttemptKey =
      `payment-attempt:${sessionId}`;

    const existingAttempt =
      await redis.get<PaymentAttempt>(
        paymentAttemptKey
      );

    if (
      existingAttempt?.status ===
      "paid"
    ) {
      return NextResponse.json(
        {
          error:
            "Payment has already been received for this booking. Continue to confirmation.",
          paymentReceived:
            true,
        },
        { status: 409 }
      );
    }

    if (
      existingAttempt?.status ===
      "ready" &&
      existingAttempt.token &&
      existingAttempt.paymentUrl &&
      existingAttempt.tokenIssuedAt
    ) {
      const tokenAge =
        Date.now() -
        existingAttempt.tokenIssuedAt;

      if (
        tokenAge <=
        HOSTED_TOKEN_REUSE_MS
      ) {
        return NextResponse.json({
          token:
            existingAttempt.token,
          paymentUrl:
            existingAttempt.paymentUrl,
          reused:
            true,
        });
      }

      /*
       * Authorize.Net form tokens are valid for
       * 15 minutes. Do not mint a second token for
       * the same booking session after that point:
       * an already-open hosted form could still be
       * in another browser/tab. Require a fresh
       * booking session instead.
       */
      return NextResponse.json(
        {
          error:
            "This payment session has expired. Please restart the booking so a new secure payment session can be created.",
          restartRequired:
            true,
        },
        { status: 409 }
      );
    }

    if (
      existingAttempt?.status ===
      "creating"
    ) {
      const creationAge =
        Date.now() -
        existingAttempt.updatedAt;

      if (creationAge < 30_000) {
        return NextResponse.json(
          {
            error:
              "The secure payment page is already being prepared. Please wait a moment and try again.",
            pending:
              true,
          },
          { status: 409 }
        );
      }

      /*
       * A stale "creating" claim never exposed a
       * usable token to the browser. It is safe to
       * replace after the short creation window.
       */
      await redis.del(
        paymentAttemptKey
      );
    }

    paymentAttemptClaimId =
      crypto.randomUUID();

    const now =
      Date.now();

    const paymentAttempt:
      PaymentAttempt = {
      sessionId,
      claimId:
        paymentAttemptClaimId,
      session,
      status:
        "creating",
      createdAt:
        now,
      updatedAt:
        now,
    };

    const attemptClaim =
      await redis.set(
        paymentAttemptKey,
        paymentAttempt,
        {
          nx: true,
          ex:
            PAYMENT_ATTEMPT_TTL_SECONDS,
        }
      );

    if (attemptClaim !== "OK") {
      const racedAttempt =
        await redis.get<PaymentAttempt>(
          paymentAttemptKey
        );

      if (
        racedAttempt?.status ===
        "ready" &&
        racedAttempt.token &&
        racedAttempt.paymentUrl &&
        racedAttempt.tokenIssuedAt &&
        Date.now() -
        racedAttempt.tokenIssuedAt <=
        HOSTED_TOKEN_REUSE_MS
      ) {
        return NextResponse.json({
          token:
            racedAttempt.token,
          paymentUrl:
            racedAttempt.paymentUrl,
          reused:
            true,
        });
      }

      return NextResponse.json(
        {
          error:
            "The secure payment page is already being prepared. Please wait a moment and try again.",
          pending:
            true,
        },
        { status: 409 }
      );
    }

    paymentAttemptClaimed =
      true;

    const cancelUrl =
      `${siteUrl}/locations/${session.location}/book-now`;

    const returnUrl =
      `${siteUrl}/book/confirm?sessionId=${encodeURIComponent(
        sessionId
      )}`;

    const payload = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: loginId,
          transactionKey,
        },

        refId: sessionId,

        transactionRequest: {
          transactionType:
            "authCaptureTransaction",

          amount:
            amount.toFixed(2),

          order: {
            invoiceNumber:
              "ERM-" +
              Date.now()
                .toString()
                .slice(-10),

            description:
              session.roomName ||
              "Escape Room Mystery booking",
          },

          customer: {
            email:
              session.email,
          },

          billTo: {
            firstName:
              session.firstName,

            lastName:
              session.lastName,

            phoneNumber:
              session.phone,
          },
        },

        hostedPaymentSettings: {
          setting: [
            {
              settingName:
                "hostedPaymentReturnOptions",

              settingValue:
                JSON.stringify({
                  showReceipt:
                    false,

                  url:
                    returnUrl,

                  urlText:
                    "Confirm Booking",

                  cancelUrl,

                  cancelUrlText:
                    "Cancel",
                }),
            },

            {
              settingName:
                "hostedPaymentButtonOptions",

              settingValue:
                JSON.stringify({
                  text:
                    "Pay Now",
                }),
            },

            {
              settingName:
                "hostedPaymentStyleOptions",

              settingValue:
                JSON.stringify({
                  bgColor:
                    "000000",
                }),
            },

            {
              settingName:
                "hostedPaymentPaymentOptions",

              settingValue:
                JSON.stringify({
                  cardCodeRequired:
                    true,

                  showCreditCard:
                    true,

                  showBankAccount:
                    false,
                }),
            },

            {
              settingName:
                "hostedPaymentBillingAddressOptions",

              settingValue:
                JSON.stringify({
                  show:
                    false,

                  required:
                    false,
                }),
            },

            {
              settingName:
                "hostedPaymentSecurityOptions",

              settingValue:
                JSON.stringify({
                  captcha:
                    false,
                }),
            },

            {
              settingName:
                "hostedPaymentCustomerOptions",

              settingValue:
                JSON.stringify({
                  showEmail:
                    true,

                  requiredEmail:
                    true,
                }),
            },
          ],
        },
      },
    };

    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          signal:
            AbortSignal.timeout(
              AUTHORIZE_TIMEOUT_MS
            ),
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify(
              payload
            ),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      data?.messages
        ?.resultCode !== "Ok" ||
      !data?.token
    ) {
      console.error(
        "Authorize.Net hosted payment request failed.",
        {
          status:
            response.status,
          sessionId,
        }
      );

      const currentAttempt =
        await redis.get<PaymentAttempt>(
          paymentAttemptKey
        );

      if (
        currentAttempt?.claimId ===
        paymentAttemptClaimId &&
        currentAttempt.status ===
        "creating"
      ) {
        await redis.del(
          paymentAttemptKey
        );
      }

      paymentAttemptClaimed =
        false;

      return NextResponse.json(
        {
          error:
            "Authorize.net rejected the hosted payment request.",
        },
        { status: 502 }
      );
    }

    const currentAttempt =
      await redis.get<PaymentAttempt>(
        paymentAttemptKey
      );

    if (
      !currentAttempt ||
      currentAttempt.claimId !==
      paymentAttemptClaimId
    ) {
      console.error(
        "Payment attempt ownership changed before token storage.",
        {
          sessionId,
        }
      );

      return NextResponse.json(
        {
          error:
            "Could not securely preserve the payment session. Please restart the booking.",
        },
        { status: 409 }
      );
    }

    const tokenIssuedAt =
      Date.now();

    const readyAttempt:
      PaymentAttempt = {
      ...currentAttempt,
      status:
        "ready",
      token:
        String(data.token),
      paymentUrl,
      tokenIssuedAt,
      updatedAt:
        tokenIssuedAt,
    };

    await redis.set(
      paymentAttemptKey,
      readyAttempt,
      {
        ex:
          PAYMENT_ATTEMPT_TTL_SECONDS,
      }
    );

    paymentAttemptClaimed =
      false;

    return NextResponse.json({
      token:
        data.token,
      paymentUrl,
    });
  } catch (error) {
    if (
      paymentAttemptClaimed &&
      paymentAttemptKey &&
      paymentAttemptClaimId
    ) {
      try {
        const currentAttempt =
          await redis.get<PaymentAttempt>(
            paymentAttemptKey
          );

        if (
          currentAttempt?.claimId ===
          paymentAttemptClaimId &&
          currentAttempt.status ===
          "creating"
        ) {
          await redis.del(
            paymentAttemptKey
          );
        }
      } catch (cleanupError) {
        console.error(
          "Payment-attempt cleanup failed.",
          {
            reason:
              cleanupError instanceof Error
                ? cleanupError.name
                : "unknown",
          }
        );
      }
    }

    const isTimeout =
      error instanceof Error &&
      (
        error.name ===
        "TimeoutError" ||
        error.name ===
        "AbortError"
      );

    console.error(
      "Authorize.Net hosted payment token request failed.",
      {
        reason:
          isTimeout
            ? "timeout"
            : "request_error",
      }
    );

    return NextResponse.json(
      {
        error:
          isTimeout
            ? "The payment service took too long to respond. Please try again."
            : "Failed to create hosted payment token.",
      },
      {
        status:
          isTimeout
            ? 504
            : 500,
      }
    );
  }
}