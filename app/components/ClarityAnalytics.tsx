"use client";

import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";

const CLARITY_PROJECT_ID = "xq2oh1xjx6";

function isSensitiveAnalyticsPath(
  pathname: string
) {
  return (
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

export default function ClarityAnalytics() {
  const pathname =
    usePathname();

  const isSensitive =
    isSensitiveAnalyticsPath(
      pathname
    );

  useEffect(() => {
    if (
      isSensitive &&
      typeof window !== "undefined" &&
      typeof window.clarity === "function"
    ) {
      /*
       * If Clarity was already loaded on a public page before
       * client-side navigation enters a sensitive route, revoke
       * tracking immediately. Microsoft documents consent=false
       * as clearing Clarity cookies and preventing further tracking
       * until consent is granted again.
       */
      window.clarity(
        "consent",
        false
      );
    }
  }, [isSensitive]);

  if (isSensitive) {
    return null;
  }

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
    >
      {`
        (function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){
            (c[a].q=c[a].q||[]).push(arguments)
          };
          t=l.createElement(r);
          t.async=1;
          t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];
          y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");
      `}
    </Script>
  );
}
