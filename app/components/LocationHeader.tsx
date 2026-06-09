import Link from "next/link";

type LocationHeaderProps = {
  locationName: string;
  locationSubtitle: string;
  homeHref: string;
  roomsHref: string;
  bookHref: string;
};

export default function LocationHeader({
  locationName,
  locationSubtitle,
  homeHref,
  roomsHref,
  bookHref,
}: LocationHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-black uppercase tracking-tight">
          ESCAPE ROOM MYSTERY
        </Link>

        <nav className="hidden items-center gap-8 text-base font-black md:flex">
          <Link href={homeHref}>Home</Link>
          <Link href={roomsHref}>Explore Rooms</Link>
        </nav>

        <div className="flex items-center gap-6">
          <div className="text-right leading-tight">
            <div className="text-sm font-black uppercase">{locationName}</div>
            <div className="text-xs font-bold text-slate-500">
              {locationSubtitle}
            </div>
          </div>

          <Link
            href={bookHref}
            className="rounded-full bg-orange-500 px-6 py-3 text-sm font-black uppercase text-white hover:bg-orange-600"
          >
            Book Now
          </Link>
        </div>
      </div>
    </header>
  );
}