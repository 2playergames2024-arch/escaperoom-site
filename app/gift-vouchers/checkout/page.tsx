"use client";

import { useEffect } from "react";

export default function GiftVoucherCheckoutPage() {
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher";
    script.async = true;

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  return (
    <main style={{ padding: "40px" }}>
      <div id="bookeo_position"></div>
    </main>
  );
}