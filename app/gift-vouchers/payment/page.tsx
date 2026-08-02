"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function GiftVoucherPaymentPage() {
  const searchParams = useSearchParams();

  const location =
    searchParams.get("location") === "cherry-hill"
      ? "cherry-hill"
      : "king-of-prussia";

  const players = Number(searchParams.get("players") ?? "1");

  const firstName = searchParams.get("firstName") ?? "";
  const lastName = searchParams.get("lastName") ?? "";
  const email = searchParams.get("email") ?? "";
  const phone = searchParams.get("phone") ?? "";

  const locationName =
    location === "king-of-prussia"
      ? "King of Prussia"
      : "Cherry Hill";

  const voucherAmount = players * 35;

  const taxRate =
    location === "king-of-prussia"
      ? 0.10
      : 0.06625;

  const tax = voucherAmount * taxRate;
  const total = voucherAmount + tax;

  const backHref =
    `/gift-vouchers/details?` +
    new URLSearchParams({
      location,
      players: players.toString(),
      firstName,
      lastName,
      email,
      phone,
    }).toString();

  return (
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">

        <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Gift Vouchers
        </p>

        <h1 className="mt-2 text-4xl font-black">
          Review &amp; Pay
        </h1>

        <div className="mt-10 rounded-lg border-2 border-slate-200 p-6">

          <div className="flex justify-between py-2">
            <span className="font-semibold">
              Location
            </span>

            <span>
              {locationName}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span className="font-semibold">
              Gift Voucher
            </span>

            <span>
              {players} {players === 1 ? "Player" : "Players"}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span className="font-semibold">
              Purchaser
            </span>

            <span>
              {firstName} {lastName}
            </span>
          </div>

          <div className="flex justify-between py-2">
            <span className="font-semibold">
              Email
            </span>

            <span>
              {email}
            </span>
          </div>

          {phone && (
            <div className="flex justify-between py-2">
              <span className="font-semibold">
                Phone
              </span>

              <span>
                {phone}
              </span>
            </div>
          )}

        </div>

        <div className="mt-10 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">

          <div className="flex justify-between py-2 text-lg">
            <span>
              Gift Voucher
            </span>

            <span>
              ${voucherAmount.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between py-2 text-lg">
            <span>
              Tax
            </span>

            <span>
              ${tax.toFixed(2)}
            </span>
          </div>

          <div className="mt-4 flex justify-between border-t-2 border-orange-300 pt-4 text-2xl font-black">
            <span>
              Total
            </span>

            <span>
              ${total.toFixed(2)}
            </span>
          </div>

        </div>

        <div className="mt-12 flex gap-4">

          <Link
            href={backHref}
            className="flex-1 rounded-lg border-2 border-slate-400 px-6 py-4 text-center text-xl font-black hover:bg-slate-100"
          >
            Back
          </Link>

          <button
            type="button"
            onClick={() => {
              window.location.href = "YOUR_BOOKEO_GIFT_VOUCHER_URL";
            }}
            className="flex-1 rounded-lg bg-orange-500 px-6 py-4 text-xl font-black text-white hover:bg-orange-600"
          >
            Pay Securely
          </button>

        </div>

      </section>
    </main>
  );
}