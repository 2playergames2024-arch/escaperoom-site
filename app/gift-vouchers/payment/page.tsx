import { Suspense } from "react";
import GiftVoucherPaymentClient from "./GiftVoucherPaymentClient";

export default function GiftVoucherPaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white px-6 py-16">
          <p className="text-center text-xl font-semibold">
            Loading payment...
          </p>
        </main>
      }
    >
      <GiftVoucherPaymentClient />
    </Suspense>
  );
}