"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import LocationHeader from "../../components/LocationHeader";

declare global {
  interface Window {
    Bookeo?: {
      init: () => void;
    };
  }
}

export default function GiftVoucherCheckoutPage() {
  const searchParams = useSearchParams();

  const location =
    searchParams.get("location") === "cherry-hill"
      ? "cherry-hill"
      : "king-of-prussia";

  const isKingOfPrussia = location === "king-of-prussia";

  const locationName = isKingOfPrussia
    ? "King of Prussia"
    : "Cherry Hill";

  const locationSubtitle = isKingOfPrussia
    ? "Pennsylvania"
    : "New Jersey";

  const homeHref = isKingOfPrussia
    ? "/locations/king-of-prussia"
    : "/locations/cherry-hill";

  const roomsHref = isKingOfPrussia
    ? "/locations/king-of-prussia/rooms"
    : "/locations/cherry-hill/rooms";

  const bookHref = isKingOfPrussia
    ? "/locations/king-of-prussia/book-now"
    : "/locations/cherry-hill/book-now";

  useEffect(() => {
    if (window.Bookeo?.init) {
      window.Bookeo.init();
    }
  }, []);

  return (
    <>
      <LocationHeader
        locationName={locationName}
        locationSubtitle={locationSubtitle}
        homeHref={homeHref}
        roomsHref={roomsHref}
        bookHref={bookHref}
      />

      <Script
        src="https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher"
        strategy="afterInteractive"
      />

      <main className="min-h-screen bg-white px-6 py-12">
        <div
          id="bookeo-widget"
          className="mx-auto max-w-6xl"
        />
      </main>
    </>
  );
}