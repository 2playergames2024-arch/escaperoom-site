import Link from "next/link";

type LocationFooterProps = {
  locationName: string;
  streetAddress: string;
  cityStateZip: string;
  phone: string;
  bookHref: string;
  roomsHref: string;
};

export default function LocationFooter({
  locationName,
  streetAddress,
  cityStateZip,
  phone,
  bookHref,
  roomsHref,
}: LocationFooterProps) {
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h3 className="mb-4 text-2xl font-black uppercase">
              Escape Room Mystery
            </h3>

            <p className="mb-2 font-black">{locationName}</p>
            <p>{streetAddress}</p>
            <p>{cityStateZip}</p>
            <p>{phone}</p>
          </div>

          <div className="space-y-3 font-bold">
            <div>
              <Link href={bookHref}>Book a Game</Link>
            </div>

            <div>
              <Link href={roomsHref}>Explore Rooms</Link>
            </div>

            <div>
              <Link href="/faq">FAQ</Link>
            </div>

            <div>
              <Link href="/contact">Contact Us</Link>
            </div>

          </div>
        </div>

        <div className="mt-10 border-t border-slate-700 pt-6 text-sm">
          <div className="flex gap-6">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-and-conditions">Terms & Conditions</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}