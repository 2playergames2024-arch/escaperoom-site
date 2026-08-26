import { redirect } from "next/navigation";
import LocationBookingPage from "../../../components/LocationBookingPage";

export default function KingOfPrussiaBookNowPage() {
  const bookingDisabled =
    process.env.BOOKING_TEMPORARILY_DISABLED === "true";

  if (bookingDisabled) {
    redirect("/booking-temporarily-unavailable");
  }

  return (
    <LocationBookingPage locationSlug="king-of-prussia" />
  );
}