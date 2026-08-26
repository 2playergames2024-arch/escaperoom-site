export default function BookingTemporarilyUnavailablePage() {
  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-2xl rounded-[18px] border-2 border-slate-950 p-8 text-center shadow-lg">
        <h1 className="text-4xl font-black">
          Online Booking Temporarily Unavailable
        </h1>

        <p className="mt-6 text-lg font-bold leading-8">
          We&apos;re temporarily unable to process online bookings.
        </p>

        <p className="mt-4 text-lg leading-8">
          Please contact Escape Room Mystery for assistance with your reservation.
        </p>

        <a
          href="/contact"
          className="mt-8 inline-block rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
        >
          Contact Us
        </a>
      </section>
    </main>
  );
}