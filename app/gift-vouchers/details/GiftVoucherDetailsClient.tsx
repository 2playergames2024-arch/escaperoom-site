"use client";

import { useSearchParams } from "next/navigation";
import LocationHeader from "../../components/LocationHeader";

export default function GiftVoucherDetailsClient() {
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

  const otherLocationHref = isKingOfPrussia
    ? "/gift-vouchers/details?location=cherry-hill"
    : "/gift-vouchers/details?location=king-of-prussia";

  const otherLocationName = isKingOfPrussia
    ? "Cherry Hill"
    : "King of Prussia";

  return (
    <>
      <LocationHeader
        locationName={locationName}
        locationSubtitle={locationSubtitle}
        homeHref={homeHref}
        roomsHref={roomsHref}
        bookHref={bookHref}
      />

      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
            Gift Vouchers
          </p>

          <h1 className="mt-2 text-4xl font-black">
            Purchase a Gift Voucher
          </h1>

          <div className="mt-8 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
            <p className="text-xl font-black">
              Purchasing for:
            </p>

            <p className="mt-2 text-3xl font-black text-orange-600">
              {locationName}
            </p>

            <p className="mt-6 text-lg">
              Gift vouchers are valid only at this location.
            </p>

            <a
              href={otherLocationHref}
              className="mt-6 inline-block font-bold text-orange-600 hover:underline"
            >
              Need a gift voucher for {otherLocationName} instead?
            </a>
          </div>

          <div className="mt-12 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
            <h2 className="text-2xl font-black">
              Continue to Secure Checkout
            </h2>

            <p className="mt-4 text-lg">
              Gift voucher purchases are securely processed by Bookeo.
              Click Continue below to select your gift voucher,
              enter the purchaser information, and complete payment.
            </p>

            <button
              type="button"
              onClick={() => {
                window.location.href =
                  isKingOfPrussia
                    ? "/gift-vouchers/checkout?location=king-of-prussia"
                    : "/gift-vouchers/checkout?location=cherry-hill";
              }}
              className="mt-8 w-full rounded-lg bg-orange-500 px-6 py-4 text-xl font-black text-white hover:bg-orange-600"
            >
              Continue
            </button>
          </div>
        </section>
      </main>
    </>
  );
}