import Link from "next/link";

export default function SupportHeader() {
  return (
    <header className="border-b border-slate-800 bg-slate-950 text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-6 py-5">
        <Link
          href="/"
          className="font-black uppercase text-white no-underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
        >
          Escape Room Mystery
        </Link>

        <nav
          aria-label="Support navigation"
          className="flex flex-wrap gap-6"
        >
          <Link
            href="/locations/king-of-prussia"
            className="font-semibold text-white no-underline hover:text-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
          >
            King of Prussia
          </Link>

          <Link
            href="/locations/cherry-hill"
            className="font-semibold text-white no-underline hover:text-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
          >
            Cherry Hill
          </Link>

          <Link
            href="/faq"
            className="font-semibold text-white no-underline hover:text-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
          >
            FAQ
          </Link>

          <Link
            href="/contact"
            className="font-semibold text-white no-underline hover:text-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-400"
          >
            Contact
          </Link>
        </nav>
      </div>
    </header>
  );
}