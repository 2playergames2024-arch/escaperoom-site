"use client";

import { useEffect, useRef } from "react";

export default function GiftVoucherCheckoutPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const container = containerRef.current;
    if (!container) return;

    console.log("Bookeo inject starting");

    // Clear once
    container.innerHTML = "";

    const marker = document.createElement("div");
    marker.id = "bookeo_position";
    container.appendChild(marker);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src =
      "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher";
    script.async = true;

    script.onload = () => {
      console.log("Bookeo script onload fired");

      if ((window as any).Bookeo?.init) {
        console.log("Calling window.Bookeo.init()");
        (window as any).Bookeo.init();
      }

      // Check after a short delay
      setTimeout(() => {
        const iframes = container.querySelectorAll("iframe").length;
        console.log("Iframes found:", iframes);
        console.log("Container content length:", container.innerHTML.length);
      }, 1500);
    };

    script.onerror = () => {
      console.error("Bookeo script failed to load");
    };

    container.appendChild(script);
  }, []);

  return (
    <main style={{ padding: "40px", minHeight: "800px" }}>
      <div ref={containerRef} id="bookeo-container" />
    </main>
  );
}