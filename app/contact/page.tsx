import type { Metadata } from "next";
import SupportHeader from "../components/SupportHeader";
import SupportFooter from "../components/SupportFooter";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact Escape Room Mystery with questions about bookings, parties, team-building events, or our escape rooms in King of Prussia, PA and Cherry Hill, NJ.",
};

type ContactPageProps = {
  searchParams: Promise<{
    sent?: string | string[];
  }>;
};

export default async function ContactPage({
  searchParams,
}: ContactPageProps) {
  const params =
    await searchParams;

  const sent =
    params.sent === "true";

  return (
    <>
      <SupportHeader />

      <main className="min-h-screen bg-slate-950 text-white">
        <section className="mx-auto max-w-3xl px-6 py-16">
          <h1 className="mb-4 text-4xl font-black">
            Contact Escape Room Mystery
          </h1>

          <p className="mb-8 leading-relaxed text-slate-300">
            Have a question about booking, parties, team-building,
            or one of our rooms? Send us a message and we&apos;ll
            get back to you.
          </p>

          {sent ? (
            <div
              role="status"
              className="rounded-xl border-2 border-green-400 bg-green-950/40 p-6"
            >
              <h2 className="text-2xl font-black text-green-300">
                Message sent successfully
              </h2>

              <p className="mt-3 leading-relaxed text-slate-200">
                Thank you for contacting Escape Room Mystery.
                Your message was sent successfully, and we&apos;ll
                get back to you as soon as we can.
              </p>
            </div>
          ) : (
            <form
              action="/api/contact"
              method="POST"
              className="grid gap-5"
            >
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute left-[-9999px] h-px w-px opacity-0"
              />

              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-2 block font-bold"
                >
                  Your name
                </label>

                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3.5 text-base text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-2 block font-bold"
                >
                  Your email
                </label>

                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3.5 text-base text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-phone"
                  className="mb-2 block font-bold"
                >
                  Phone number{" "}
                  <span className="font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <input
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3.5 text-base text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-2 block font-bold"
                >
                  How can we help?
                </label>

                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={6}
                  className="w-full rounded-lg border border-slate-600 bg-slate-900 px-4 py-3.5 text-base text-white outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <button
                type="submit"
                className="w-fit rounded-lg bg-orange-500 px-6 py-3.5 font-black text-white hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300"
              >
                Send Message
              </button>
            </form>
          )}
        </section>
      </main>

      <SupportFooter />
    </>
  );
}
