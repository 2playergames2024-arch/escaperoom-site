import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { incrementRateLimit } from "@/app/lib/rateLimit";
import {
  type BookingSession,
  type PaymentAttempt,
  type AuthorizeEvent,
  type VerifiedPayment,
  isValidBookingSessionId,
} from "../../../lib/booking";

const redis = Redis.fromEnv();

const AUTHORIZE_VERIFY_TIMEOUT_MS = 15_000;
const PAYMENT_STATE_TTL_SECONDS =
  60 * 60 * 24 * 30;

export async function POST(req: Request) {
  try {
    /*
     * Confirmation can legitimately poll while waiting
     * for the Authorize.Net webhook, so this limit is
     * intentionally higher than payment-token creation.
     */
    const forwardedFor =
      req.headers.get("x-forwarded-for");

    const ip =
      forwardedFor?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const rateLimitKey =
      `rate-limit:verify-payment:${ip}`;

    const attempts =
    await incrementRateLimit(
      redis,
      rateLimitKey,
      600
    );

    if (attempts > 60) {
      return NextResponse.json(
        {
          verified: false,
          error:
            "Too many payment verification requests. Please wait a few minutes and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": "600",
          },
        }
      );
    }

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
            "Missing booking session ID.",
        },
        { status: 400 }
      );
    }

    const loginId =
      process.env.AUTHORIZE_LOGIN_ID;

    const transactionKey =
      process.env.AUTHORIZE_TRANSACTION_KEY;

    const environment =
      process.env.AUTHORIZE_ENVIRONMENT ||
      "production";

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

    let session =
      await redis.get<BookingSession>(
        `booking-session:${sessionId}`
      );

    if (!session) {
      const paymentAttempt =
        await redis.get<PaymentAttempt>(
          `payment-attempt:${sessionId}`
        );

      if (
        paymentAttempt?.session
          ?.sessionId ===
        sessionId
      ) {
        session =
          paymentAttempt.session;
      }
    }

    if (!session) {
      return NextResponse.json(
        {
          error:
            "Booking session not found.",
        },
        { status: 404 }
      );
    }

    /*
     * IDEMPOTENT FAST PATH:
     *
     * Once payment has already been independently
     * verified, there is no reason to call
     * Authorize.Net again.
     */
    const existingVerification =
      await redis.get<VerifiedPayment>(
        `verified-payment:${sessionId}`
      );

    if (
      existingVerification?.sessionId ===
      sessionId
    ) {
      return NextResponse.json({
        verified: true,
        transactionId:
          existingVerification.transactionId,
        alreadyVerified: true,
      });
    }

    const authorizeEvent =
      await redis.get<AuthorizeEvent>(
        `authorize-event:${sessionId}`
      );

    if (
      !authorizeEvent?.transactionId
    ) {
      return NextResponse.json(
        {
          verified: false,
          pending: true,
          error:
            "Payment notification has not arrived yet.",
        },
        { status: 202 }
      );
    }

    /*
     * The signed webhook binds this
     * Authorize.Net transaction to this
     * exact ERM booking session.
     */
    if (
      authorizeEvent.sessionId !==
      sessionId
    ) {
      return NextResponse.json(
        {
          verified: false,
          error:
            "Payment notification does not match this booking.",
        },
        { status: 403 }
      );
    }

    const apiUrl =
      environment === "sandbox"
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    const payload = {
      getTransactionDetailsRequest: {
        merchantAuthentication: {
          name: loginId,
          transactionKey,
        },
        transId:
          authorizeEvent.transactionId,
      },
    };

    const response =
      await fetch(
        apiUrl,
        {
          method: "POST",
          signal:
            AbortSignal.timeout(
              AUTHORIZE_VERIFY_TIMEOUT_MS
            ),
          headers: {
            "Content-Type":
              "application/json",
          },
          cache: "no-store",
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
      data?.messages?.resultCode !==
        "Ok" ||
      !data?.transaction
    ) {
      console.error(
        "Authorize.Net transaction verification rejected.",
        {
          sessionId,
          status:
            response.status,
        }
      );

      return NextResponse.json(
        {
          verified: false,
          error:
            "Authorize.net transaction could not be verified.",
        },
        { status: 400 }
      );
    }

    const transaction =
      data.transaction;

    const expectedAmount =
      Number(session.total);

    const actualAmount =
      Number(
        transaction.authAmount
      );

    const amountMatches =
      Number.isFinite(
        expectedAmount
      ) &&
      Number.isFinite(
        actualAmount
      ) &&
      Math.abs(
        expectedAmount -
          actualAmount
      ) < 0.001;

    const acceptableStatuses = [
      "capturedPendingSettlement",
      "settledSuccessfully",
    ];

    const transactionStatus =
      String(
        transaction.transactionStatus ||
          ""
      );

    const statusIsValid =
      acceptableStatuses.includes(
        transactionStatus
      );

    if (
      !amountMatches ||
      !statusIsValid
    ) {
      console.error(
        "Payment verification failed.",
        {
          sessionId,
          amountMatches,
          transactionStatus,
        }
      );

      return NextResponse.json(
        {
          verified: false,
          error:
            "Payment did not pass verification.",
        },
        { status: 400 }
      );
    }

    const verifiedPayment: VerifiedPayment =
      {
        sessionId,
        transactionId:
          authorizeEvent.transactionId,
        amount:
          actualAmount.toFixed(2),
        transactionStatus,
        verifiedAt:
          Date.now(),
      };

    await redis.set(
      `verified-payment:${sessionId}`,
      verifiedPayment,
      {
        ex:
          PAYMENT_STATE_TTL_SECONDS,
      }
    );

    return NextResponse.json({
      verified: true,
      transactionId:
        authorizeEvent.transactionId,
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (
        error.name ===
          "TimeoutError" ||
        error.name ===
          "AbortError"
      );

    console.error(
      "Authorize.Net payment verification request failed.",
      {
        reason:
          isTimeout
            ? "timeout"
            : "request_error",
      }
    );

    return NextResponse.json(
      {
        verified: false,
        error:
          isTimeout
            ? "The payment service took too long to respond. Please try again."
            : "Payment verification failed.",
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