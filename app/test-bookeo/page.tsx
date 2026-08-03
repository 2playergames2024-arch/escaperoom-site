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

  return <h1>Bookeo Test1</h1>;
}

<script>
window.addEventListener("load", function () {
  const scripts = [...document.getElementsByTagName("script")];

  const bookeoScript = scripts.find(s =>
    s.src.includes("bookeo.com/widget.js")
  );

  console.log("Bookeo script found:", !!bookeoScript);
  console.log(bookeoScript);

  console.log(
    "bookeo_position exists:",
    !!document.getElementById("bookeo_position")
  );
});
</script>