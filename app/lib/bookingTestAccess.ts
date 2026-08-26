import {
  createHmac,
  timingSafeEqual,
} from "crypto";

export const BOOKING_TEST_COOKIE_NAME =
  "erm_booking_test_access";

const COOKIE_MESSAGE =
  "escape-room-mystery-booking-test-access-v1";

export function getBookingTestCookieValue() {
  const secret =
    process.env
      .BOOKING_TEST_BYPASS_TOKEN;

  if (!secret) {
    return null;
  }

  return createHmac(
    "sha256",
    secret.trim()
  )
    .update(COOKIE_MESSAGE)
    .digest("hex");
}

export function isValidBookingTestCookie(
  value: string | undefined
) {
  if (!value) {
    return false;
  }

  const expected =
    getBookingTestCookieValue();

  if (!expected) {
    return false;
  }

  const providedBuffer =
    Buffer.from(value);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    providedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    providedBuffer,
    expectedBuffer
  );
}