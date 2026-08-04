"use client";

import { useEffect } from "react";

export default function TestBookeoPage() {
  useEffect(() => {
    const div = document.createElement("div");
    div.id = "bookeo-widget";
    document.body.appendChild(div);

    (window as any).axiomct_loadProvider = function (...args: any[]) {
      console.log("axiomct_loadProvider CALLED", args);

      return (window as any).__realLoadProvider.apply(this, args);
    };

    const script = document.createElement("script");
    script.src =
      "https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher";
    script.async = true;

    script.onload = () => {
      (window as any).__realLoadProvider = (window as any).axiomct_loadProvider;

      (window as any).axiomct_loadProvider = function (...args: any[]) {
        console.log("axiomct_loadProvider CALLED", args);
        return (window as any).__realLoadProvider.apply(this, args);
      };

      const scripts = [...document.getElementsByTagName("script")];

      const bookeoScript = scripts.find((s) =>
        s.src.includes("bookeo.com/widget.js")
      );

      console.log("Bookeo script found:", !!bookeoScript);
      console.log(bookeoScript);

      console.log(
        "bookeo_position exists:",
        !!document.getElementById("bookeo_position")
      );
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
      div.remove();
    };
  }, []);

  return <h1>Bookeo Test3</h1>;
}