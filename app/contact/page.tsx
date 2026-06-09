import SupportHeader from "../components/SupportHeader";
import SupportFooter from "../components/SupportFooter";

export default function ContactPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0b0f1a", color: "white" }}>
      <SupportHeader />

      <section style={{ maxWidth: "768px", margin: "0 auto", padding: "64px 24px" }}>
        <h1 style={{ fontSize: "40px", fontWeight: "bold", marginBottom: "16px" }}>
          Contact Escape Room Mystery
        </h1>

        <p style={{ color: "#d1d5db", marginBottom: "32px", lineHeight: "1.6" }}>
          Have a question about booking, parties, team-building, or one of our rooms?
          Send us a message and we’ll get back to you.
        </p>

        <form action="/api/contact" method="POST" style={{ display: "grid", gap: "20px" }}>
          <input name="name" required placeholder="Your name" style={fieldStyle} />
          <input name="email" type="email" required placeholder="Your email" style={fieldStyle} />
          <input name="phone" placeholder="Phone number" style={fieldStyle} />
          <textarea name="message" required placeholder="How can we help?" rows={6} style={fieldStyle} />

          <button type="submit" style={buttonStyle}>
            Send Message
          </button>
        </form>
      </section>

      <SupportFooter />
    </main>
  );
}

const fieldStyle = {
  width: "100%",
  borderRadius: "8px",
  border: "1px solid #374151",
  background: "#111827",
  color: "white",
  padding: "14px 16px",
  fontSize: "16px",
};

const buttonStyle = {
  width: "fit-content",
  borderRadius: "8px",
  background: "#dc2626",
  color: "white",
  padding: "14px 24px",
  fontWeight: "bold",
  border: "none",
  cursor: "pointer",
};