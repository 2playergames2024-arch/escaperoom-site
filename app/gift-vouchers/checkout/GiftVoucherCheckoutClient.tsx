"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import LocationHeader from "../../components/LocationHeader";

declare global {
  interface Window {
    Bookeo?: {
      init: () => void;
    };
  }
}

export default function GiftVoucherCheckoutClient() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const location =
    searchParams.get("location") === "cherry-hill"
      ? "cherry-hill"
      : "king-of-prussia";

  const isKingOfPrussia = location === "king-of-prussia";

  const locationName = isKingOfPrussia ? "King of Prussia" : "Cherry Hill";
  const locationSubtitle = isKingOfPrussia ? "Pennsylvania" : "New Jersey";

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
    setMounted(true);

    // Load the Bookeo script only on the client
    const script = document.createElement("script");
    script.src = "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6";
    script.async = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.Bookeo?.init) {
        window.Bookeo.init();
      }
    };

    return () => {
      // cleanup if needed
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
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

      <main className="min-h-screen bg-white px-6 py-12">
        {/* Always render the container so Bookeo can find it */}
        <div
          id="bookeo-widget"
          className="mx-auto max-w-6xl"
          suppressHydrationWarning
        />
      </main>
    </>
  );
}