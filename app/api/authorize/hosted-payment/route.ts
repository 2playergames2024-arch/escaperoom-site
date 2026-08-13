import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

type TrustedBookeoHold = {
  holdId: string;
  productId: string;
  eventId: string;
  players: string;
  location: string;
  total: string;
  createdAt: number;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const loginId = process.env.AUTHORIZE_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_TRANSACTION_KEY;
    const environment =
      process.env.AUTHORIZE_ENVIRONMENT || "production";
    const siteUrl = process.env.SITE_URL;

    if (!siteUrl) {
      return NextResponse.json(
        { error: "SITE_URL is not configured." },
        { status: 500 }
      );
    }

    if (!loginId || !transactionKey) {
      return NextResponse.json(
        { error: "Authorize.net credentials are missing." },
        { status: 500 }
      );
    }

    if (!body.holdId) {
      return NextResponse.json(
        { error: "Missing booking hold." },
        { status: 400 }
      );
    }

    /*
     * Get the trusted booking information that our server saved
     * directly from Bookeo when the hold was created.
     */
    const trustedHold = await redis.get<TrustedBookeoHold>(
      `bookeo-hold:${body.holdId}`
    );

    if (!trustedHold) {
      return NextResponse.json(
        {
          error:
            "Booking hold could not be verified. Please select your room and time again.",
        },
        { status: 400 }
      );
    }

    /*
     * Make sure the hold being paid for matches the booking
     * information our server received from Bookeo.
     */
    if (
      trustedHold.holdId !== body.holdId ||
      trustedHold.productId !== body.productId ||
      trustedHold.eventId !== body.eventId ||
      trustedHold.players !== String(body.players)
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
     * IMPORTANT:
     * The payment amount comes ONLY from the server-side Bookeo record.
     * We do not trust an amount supplied by the customer's browser.
     */
    const amount = Number(trustedHold.total);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid verified payment amount." },
        { status: 500 }
      );
    }

    const location =
      trustedHold.location === "cherry-hill"
        ? "cherry-hill"
        : "king-of-prussia";

    const apiUrl =
      environment === "sandbox"
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    const cancelUrl =
      `${siteUrl}/locations/${location}/book-now`;

    const payload = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: loginId,
          transactionKey,
        },

        refId: body.sessionId,

        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: amount.toFixed(2),

          order: {
            invoiceNumber:
              "ERM-" + Date.now().toString().slice(-10),
            description:
              body.description || "Escape Room Mystery booking",
          },

          customer: {
            email: body.email || "",
          },

          billTo: {
            firstName: body.firstName || "",
            lastName: body.lastName || "",
            phoneNumber: body.phone || "",
          },
        },

        hostedPaymentSettings: {
          setting: [
            {
              settingName: "hostedPaymentReturnOptions",
              settingValue: JSON.stringify({
                showReceipt: false,
                url:
                  `${siteUrl}/book/confirm` +
                  `?sessionId=${encodeURIComponent(
                    body.sessionId
                  )}`,
                urlText: "Continue",
                cancelUrl,
                cancelUrlText: "Cancel",
              }),
            },

            {
              settingName: "hostedPaymentButtonOptions",
              settingValue: JSON.stringify({
                text: "Pay Now",
              }),
            },

            {
              settingName: "hostedPaymentStyleOptions",
              settingValue: JSON.stringify({
                bgColor: "000000",
              }),
            },

            {
              settingName: "hostedPaymentPaymentOptions",
              settingValue: JSON.stringify({
                cardCodeRequired: true,
                showCreditCard: true,
                showBankAccount: false,
              }),
            },

            {
              settingName: "hostedPaymentBillingAddressOptions",
              settingValue: JSON.stringify({
                show: false,
                required: false,
              }),
            },

            {
              settingName: "hostedPaymentSecurityOptions",
              settingValue: JSON.stringify({
                captcha: false,
              }),
            },

            {
              settingName: "hostedPaymentCustomerOptions",
              settingValue: JSON.stringify({
                showEmail: true,
                requiredEmail: true,
              }),
            },
          ],
        },
      },
    };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data?.messages?.resultCode !== "Ok") {
      console.log(
        "AUTHORIZE.NET ERROR:",
        JSON.stringify(data, null, 2)
      );

      return NextResponse.json(
        {
          error:
            "Authorize.net rejected the hosted payment request.",
          details: data,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      token: data.token,
    });
  } catch (error) {
    console.log("HOSTED PAYMENT ROUTE CRASH:", error);

    return NextResponse.json(
      {
        error: "Failed to create hosted payment token.",
        details:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 }
    );
  }
}