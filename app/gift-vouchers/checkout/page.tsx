export default function GiftVoucherCheckoutPage() {
  return (
    <main style={{ padding: "40px" }}>
      <img
        src="/images/rooms/area51-action-01.jpg"
        alt="Area 51"
        style={{ maxWidth: "100%", height: "auto" }}
      />

      <div id="bookeo_position"></div>

      <script
        type="text/javascript"
        src="https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher"
      />
    </main>
  );
}