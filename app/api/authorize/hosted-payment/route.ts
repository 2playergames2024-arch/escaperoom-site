import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const loginId = process.env.AUTHORIZE_LOGIN_ID;
    const transactionKey = process.env.AUTHORIZE_TRANSACTION_KEY;
    const environment = process.env.AUTHORIZE_ENVIRONMENT || "production";

    if (!loginId || !transactionKey) {
      return NextResponse.json(
        { error: "Authorize.net credentials are missing." },
        { status: 500 }
      );
    }

    const apiUrl =
      environment === "sandbox"
        ? "https://apitest.authorize.net/xml/v1/request.api"
        : "https://api.authorize.net/xml/v1/request.api";

    const amount = Number(body.amount);

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid payment amount." },
        { status: 400 }
      );
    }

    const location =
      body.location === "cherry-hill"
        ? "cherry-hill"
        : "king-of-prussia";

    const cancelUrl =
      `${body.baseUrl}/locations/${location}/book-now`;
    const payload = {
      getHostedPaymentPageRequest: {
        merchantAuthentication: {
          name: loginId,
          transactionKey: transactionKey,
        },
        transactionRequest: {
          transactionType: "authCaptureTransaction",
          amount: amount.toFixed(2),
          order: {
            invoiceNumber: "ERM-" + Date.now().toString().slice(-10),
            description: body.description || "Escape Room Mystery booking",
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
                      `${body.baseUrl}/book/confirm` +
                      `?sessionId=${encodeURIComponent(body.sessionId)}`,
                    urlText: "Continue",
                    cancelUrl: cancelUrl,
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
        console.log("AUTHORIZE.NET ERROR:", JSON.stringify(data, null, 2));

        return NextResponse.json(
            {
            error: "Authorize.net rejected the hosted payment request.",
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
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}