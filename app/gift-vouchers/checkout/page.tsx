import { Suspense } from "react";
import GiftVoucherCheckoutClient from "./GiftVoucherCheckoutClient";

export default function GiftVoucherCheckoutPage() {
  return (
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
  );
}