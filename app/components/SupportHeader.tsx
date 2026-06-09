import Link from "next/link";

export default function SupportHeader() {
  return (
    <header style={{ background: "#020617", color: "white", borderBottom: "1px solid #1f2937" }}>
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "20px 24px", display: "flex", justifyContent: "space-between", gap: "24px" }}>
        <Link href="/" style={{ color: "white", fontWeight: "bold", textDecoration: "none" }}>
          ESCAPE ROOM MYSTERY
        </Link>

        <nav style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <Link href="/locations/king-of-prussia" style={linkStyle}>King of Prussia</Link>
          <Link href="/locations/cherry-hill" style={linkStyle}>Cherry Hill</Link>
          <Link href="/faq" style={linkStyle}>FAQ</Link>
          <Link href="/contact" style={linkStyle}>Contact</Link>
        </nav>
      </div>
    </header>
  );
}

const linkStyle = {
  color: "white",
  textDecoration: "none",
  fontWeight: "600",
};