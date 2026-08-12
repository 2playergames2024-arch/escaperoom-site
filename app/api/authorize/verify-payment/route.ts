import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type BookingSession = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  total: string;
  createdAt: number;
};

type AuthorizeEvent = {
  eventType: string;
  transactionId: string;
  sessionId: string;
  receivedAt: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const sessionId = String(body.sessionId || "");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing booking session ID." },
        { status: 400 }
      );
    }

    const loginId = process.env.AUTHORIZE_LOGIN_ID;
    const transactionKey =
      process.env.AUTHORIZE_TRANSACTION_KEY;
    const environment =
      process.env.AUTHORIZE_ENVIRONMENT || "production";

    if (!loginId || !transactionKey) {
      return NextResponse.json(
        { error: "Authorize.net credentials are missing." },
        { status: 500 }
      );
    }

    const session = await redis.get<BookingSession>(
      `booking-session:${sessionId}`
    );

    if (!session) {
      return NextResponse.json(
        { error: "Booking session not found." },
        { status: 404 }
      );
    }

    const authorizeEvent = await redis.get<AuthorizeEvent>(
      `authorize-event:${sessionId}`
    );

    if (!authorizeEvent?.transactionId) {
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
     * The signed webhook already binds this Authorize.net
     * transaction ID to this exact ERM booking session.
     */
    if (authorizeEvent.sessionId !== sessionId) {
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
        transId: authorizeEvent.transactionId,
      },
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (
      !response.ok ||
      data?.messages?.resultCode !== "Ok" ||
      !data?.transaction
    ) {
      return NextResponse.json(
        {
          verified: false,
          error:
            "Authorize.net transaction could not be verified.",
        },
        { status: 400 }
      );
    }

    const transaction = data.transaction;

    const expectedAmount = Number(session.total);
    const actualAmount = Number(transaction.authAmount);

    const amountMatches =
      Number.isFinite(expectedAmount) &&
      Number.isFinite(actualAmount) &&
      Math.abs(expectedAmount - actualAmount) < 0.001;

    const acceptableStatuses = [
      "capturedPendingSettlement",
      "settledSuccessfully",
    ];

    const statusIsValid =
      acceptableStatuses.includes(
        String(transaction.transactionStatus || "")
      );

    if (!amountMatches || !statusIsValid) {
      console.error("PAYMENT VERIFICATION FAILED:", {
        sessionId,
        transactionId:
          authorizeEvent.transactionId,
        expectedAmount,
        actualAmount,
        transactionStatus:
          transaction.transactionStatus,
      });

      return NextResponse.json(
        {
          verified: false,
          error:
            "Payment did not pass verification.",
        },
        { status: 400 }
      );
    }

    const verifiedPayment = {
      sessionId,
      transactionId:
        authorizeEvent.transactionId,
      amount: actualAmount.toFixed(2),
      transactionStatus:
        transaction.transactionStatus,
      verifiedAt: Date.now(),
    };

    await redis.set(
      `verified-payment:${sessionId}`,
      verifiedPayment,
      {
        ex: 60 * 60 * 24,
      }
    );

    return NextResponse.json({
      verified: true,
      transactionId:
        authorizeEvent.transactionId,
    });
  } catch (error) {
    console.error(
      "VERIFY PAYMENT ERROR:",
      error
    );

    return NextResponse.json(
      {
        verified: false,
        error:
          "Payment verification failed.",
      },
      { status: 500 }
    );
  }
}