import type { Metadata } from "next";
import { Suspense } from "react";
import GiftVoucherDetailsClient from "./GiftVoucherDetailsClient";

export const metadata: Metadata = {
  title: "Gift Vouchers",
  description:
    "Buy Escape Room Mystery gift vouchers for unforgettable escape room adventures in King of Prussia, PA and Cherry Hill, NJ.",
};

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