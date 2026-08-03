import LocationHeader from "../../components/LocationHeader";

export default function GiftVoucherCheckoutPage() {
  return (
    <>
      {/* We hard-code Cherry Hill for this test to remove all client complexity */}
      <LocationHeader
        locationName="Cherry Hill"
        locationSubtitle="New Jersey"
        homeHref="/locations/cherry-hill"
        roomsHref="/locations/cherry-hill/rooms"
        bookHref="/locations/cherry-hill/book-now"
      />

      <main className="min-h-screen bg-white px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div id="bookeo_position"></div>

          {/* Pure static script – exactly like the WordPress page */}
          <script
            type="text/javascript"
            src="https://bookeo.com/widget.js?a=415686T7W9919DC0FEE2A6&startmode=buyvoucher"
          />
        </div>
      </main>
    </>
  );
}