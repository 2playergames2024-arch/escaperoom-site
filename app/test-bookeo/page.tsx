"use client";

import { useEffect } from "react";

export default function TestBookeoPage() {
  useEffect(() => {
    const div = document.createElement("div");
    div.id = "bookeo-widget";
    document.body.appendChild(div);

    const script = document.createElement("script");
    script.src =
      "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      div.remove();
    };
  }, []);

  return <h1>Bookeo Test</h1>;
}