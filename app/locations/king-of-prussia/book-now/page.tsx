import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LocationBookingPage from "../../../components/LocationBookingPage";
import {
  BOOKING_TEST_COOKIE_NAME,
  isValidBookingTestCookie,
} from "../../../lib/bookingTestAccess";

export default async function KingOfPrussiaBookNowPage() {
  const bookingDisabled =
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
    bookingDisabled &&
    !hasStaffAccess
  ) {
    redirect(
      "/booking-temporarily-unavailable"
    );
  }

  return (
    <LocationBookingPage locationSlug="king-of-prussia" />
  );
}