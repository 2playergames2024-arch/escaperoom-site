import { Suspense } from "react";
import GiftVoucherCheckoutClient from "./GiftVoucherCheckoutClient";

export default function GiftVoucherCheckoutPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center">Loading gift vouchers...</div>}>
      <GiftVoucherCheckoutClient />
    </Suspense>
  );
}