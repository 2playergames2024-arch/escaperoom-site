"use client";

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
    ? "/locations/king-of-prussia#rooms"
    : "/locations/cherry-hill#rooms";

  const bookHref = isKingOfPrussia
    ? "/locations/king-of-prussia#book-now"
    : "/locations/cherry-hill#book-now";

  return (
    <>
      <LocationHeader
        locationName={locationName}
        locationSubtitle={locationSubtitle}
        homeHref={homeHref}
        roomsHref={roomsHref}
        bookHref={bookHref}
      />

      <main className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <iframe
            src={
              isKingOfPrussia
                ? "/bookeo-gift-kop.html"
                : "/bookeo-gift-ch.html"
            }
            title="Purchase Gift Voucher"
            className="w-full border-0"
            style={{ height: "900px", minHeight: "800px" }}
          />
        </div>
      </main>
    </>
  );
}