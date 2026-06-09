import SupportHeader from "@/app/components/SupportHeader";
import SupportFooter from "@/app/components/SupportFooter";

export default function PrivacyPolicyPage() {
  return (
    <>
      <SupportHeader />

      <main className="mx-auto max-w-4xl px-6 py-12 text-slate-950">
        <h1 className="mb-4 text-4xl font-black">Privacy Policy</h1>
        <p className="mb-10 font-bold text-slate-600">Effective Date: June 2026</p>

        <div className="space-y-7 leading-7">
          <p>
            Escape Room Mystery respects your privacy and is committed to protecting
            the personal information you provide when using our website, booking
            services, and contacting our business.
          </p>

          {[
            ["Information We Collect", "We may collect information that you voluntarily provide, including your name, email address, phone number, reservation and booking information, contact form submissions, and information provided when communicating with our staff. We may also automatically collect limited technical information such as IP address, browser type, device information, and website usage data."],
            ["How We Use Information", "We use information to process reservations and payments, confirm or modify bookings, communicate with customers, respond to questions, improve website performance, and comply with legal obligations."],
            ["Payment Processing", "Payments made through our website are processed by secure third-party payment providers. Escape Room Mystery does not store complete credit card information on its servers."],
            ["Cookies and Analytics", "Our website may use cookies, pixels, analytics tools, and similar technologies to improve functionality, analyze website usage, and support advertising or marketing efforts."],
            ["Information Sharing", "We do not sell personal information. Information may be shared with trusted third-party service providers when necessary to process reservations, process payments, operate our website, provide customer support, or perform analytics and advertising services."],
            ["Data Retention", "We retain information only as long as reasonably necessary for business operations, legal compliance, dispute resolution, and recordkeeping purposes."],
            ["Data Security", "We take reasonable administrative, technical, and physical measures to help protect personal information. However, no method of electronic transmission or storage can be guaranteed to be completely secure."],
            ["Children's Privacy", "Our services are intended for families and groups; however, personal information should be submitted by a parent, guardian, or responsible adult when making reservations involving minors."],
            ["Third-Party Websites", "Our website may contain links to third-party websites. We are not responsible for the privacy practices or content of external websites."],
            ["Changes to This Policy", "We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated effective date."],
          ].map(([title, text]) => (
            <section key={title}>
              <h2 className="mb-2 text-2xl font-black">{title}</h2>
              <p>{text}</p>
            </section>
          ))}

          <section>
            <h2 className="mb-2 text-2xl font-black">Contact Information</h2>

            <p className="mb-4">
                Questions regarding this Privacy Policy may be directed to:
            </p>

            <div className="space-y-4">
                <div>
                <div className="font-black">Escape Room Mystery - King of Prussia</div>
                <div>840 First Avenue, Suite 500</div>
                <div>King of Prussia, PA 19406</div>
                </div>

                <div>
                <div className="font-black">Escape Room Mystery - Cherry Hill</div>
                <div>1200 Haddonfield Road, 2nd Floor</div>
                <div>Cherry Hill, NJ 08002</div>
                </div>

                <div className="font-black">
                Phone: 610-757-1053
                </div>
            </div>
            </section>
        </div>
      </main>

      <SupportFooter />
    </>
  );
}