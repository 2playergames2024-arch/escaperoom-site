import Link from "next/link";

export default function SupportFooter() {
  return (
    <footer className="bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <div className="text-2xl font-black uppercase">
                Escape Room Mystery
            </div>

            <div className="mt-3 text-sm text-slate-300">
                <div className="font-bold">King of Prussia</div>
                <div>840 First Avenue, Suite 500</div>
                <div>King of Prussia, PA 19406</div>
            </div>

            <div className="mt-4 text-sm text-slate-300">
                <div className="font-bold">Cherry Hill</div>
                <div>1200 Haddonfield Road, 2nd Floor</div>
                <div>Cherry Hill, NJ 08002</div>
            </div>

            <div className="mt-4 text-sm font-bold text-slate-300">
                610-757-1053
            </div>
            </div>

          <div className="grid gap-3 text-sm font-bold uppercase text-slate-300">
            <Link href="/locations/king-of-prussia">King of Prussia</Link>
            <Link href="/locations/cherry-hill">Cherry Hill</Link>
            <Link href="/faq">FAQ</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>

        <div className="mt-8 flex gap-6 border-t border-slate-700 pt-6 text-sm text-slate-400">
          <Link href="/privacy-policy">Privacy Policy</Link>
          <Link href="/terms-and-conditions">Terms & Conditions</Link>
        </div>
      </div>
    </footer>
  );
}