import { Suspense } from "react";
import GiftVoucherCheckoutClient from "./GiftVoucherCheckoutClient";

export default function GiftVoucherCheckoutPage() {
  return (
    <>
      {/* Official Bookeo script – must be in the server HTML */}
      <script
        type="text/javascript"
        src="https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6"
      />

      {/* Container for the widget */}
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