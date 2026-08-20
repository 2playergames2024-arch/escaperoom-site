"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  GA4_MEASUREMENT_ID,
  ensureGoogleTag,
} from "../lib/googleAnalytics";

function isSensitivePath(
  pathname: string
) {
  return (
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    ensureGoogleTag();

    if (
      isSensitivePath(pathname) ||
      typeof window.gtag !== "function"
    ) {
      return;
    }

    window.gtag(
      "event",
      "page_view",
      {
        page_location:
          window.location.href,
        page_path:
          `${window.location.pathname}${window.location.search}`,
        page_title:
          document.title,
      }
    );
  }, [pathname]);

  return (
    <Script
      id="google-analytics-loader"
      src={`https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`}
      strategy="afterInteractive"
    />
  );
}
