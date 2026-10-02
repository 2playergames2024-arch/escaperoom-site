import "server-only";

export type SmsResult =
  | { ok: true; messageSid: string | null }
  | { ok: false; message: string };

export type SmsSender =
  | "normal"
  | "elevator";

export async function sendSms({
  to,
  body,
  sender = "normal",
}: {
  to: string;
  body: string;
  sender?: SmsSender;
}): Promise<SmsResult> {
  if (
    process.env.SMS_NOTIFICATIONS_ENABLED !==
    "true"
  ) {
    return {
      ok: false,
      message: "SMS notifications are disabled.",
    };
  }

  const accountSid =
    process.env.TWILIO_ACCOUNT_SID;
  const authToken =
    process.env.TWILIO_AUTH_TOKEN;

  const normalFrom =
    process.env.TWILIO_FROM_NUMBER1;
  const elevatorFrom =
    process.env.TWILIO_FROM_NUMBER2;

  const from =
    sender === "elevator"
      ? elevatorFrom
      : normalFrom;

  if (!accountSid || !authToken || !from) {
    return {
      ok: false,
      message:
        sender === "elevator"
          ? "Twilio elevator sender is not fully configured."
          : "Twilio normal sender is not fully configured.",
    };
  }

  const form = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${Buffer.from(
              `${accountSid}:${authToken}`
            ).toString("base64")}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body: form.toString(),
        signal: AbortSignal.timeout(5000),
      }
    );

    const data = (await response.json()) as {
      sid?: string;
      message?: string;
    };

    if (!response.ok) {
      return {
        ok: false,
        message:
          data.message ||
          `Twilio returned HTTP ${response.status}.`,
      };
    }

    return {
      ok: true,
      messageSid: data.sid ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Twilio request failed.",
    };
  }
}

