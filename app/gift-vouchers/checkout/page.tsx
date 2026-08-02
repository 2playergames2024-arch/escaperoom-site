import { Suspense } from "react";
import GiftVoucherCheckoutClient from "./GiftVoucherCheckoutClient";

export default function GiftVoucherCheckoutPage() {
  return (
    <>
      {/* This div must be in the server-rendered HTML for Bookeo’s validator */}
      <div id="bookeo-widget" className="mx-auto max-w-6xl" />

      <Suspense
        fallback={
          <main className="min-h-screen bg-white px-6 py-12">
            <p className="text-center text-xl font-semibold">
              Loading gift voucher checkout...
            </p>
          </main>
        }
      >
        <GiftVoucherCheckoutClient />
      </Suspense>
    </>
  );
}