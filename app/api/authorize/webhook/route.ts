import {
  POST as bookingV2Webhook,
} from "./bookingV2";
import {
  POST as legacyWebhook,
} from "./legacy";

export async function POST(
  request: Request
) {
  const bookingV2Enabled =
    process.env.BOOKING_V2_ENABLED
      ? process.env.BOOKING_V2_ENABLED ===
        "true"
      : process.env.AUTHORIZE_ENVIRONMENT ===
        "sandbox";

  return bookingV2Enabled
    ? bookingV2Webhook(request)
    : legacyWebhook(request);
}
