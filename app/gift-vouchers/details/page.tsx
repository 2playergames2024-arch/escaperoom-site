import { Suspense } from "react";
import GiftVoucherDetailsClient from "./GiftVoucherDetailsClient";

export default function GiftVoucherDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white px-6 py-16">
          <p className="text-center text-xl font-semibold">
            Loading gift vouchers...
          </p>
        </main>
      }
    >
      <GiftVoucherDetailsClient />
    </Suspense>
  );
}