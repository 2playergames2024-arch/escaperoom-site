"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import LocationHeader from "../../components/LocationHeader";

export default function GiftVoucherCheckoutClient() {
  const searchParams = useSearchParams();

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
    // Clear and inject the official script inside the container
    const container = document.getElementById("bookeo-widget");
    if (!container) return;

    container.innerHTML = ""; // clear any previous content

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher";
    script.async = true;

    container.appendChild(script);
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
        <div
          id="bookeo-widget"
          className="mx-auto max-w-6xl"
          style={{ minHeight: "800px" }}
        />
      </main>
    </>
  );
}