import SupportHeader from "@/app/components/SupportHeader";
import SupportFooter from "@/app/components/SupportFooter";

export default function TermsAndConditionsPage() {
  return (
    <>
      <SupportHeader />

      <main className="mx-auto max-w-4xl px-6 py-12 text-slate-950">
        <h1 className="mb-4 text-4xl font-black">
          Terms & Conditions
        </h1>

        <p className="mb-10 font-bold text-slate-600">
          Effective Date: June 2026
        </p>

        <div className="space-y-7 leading-7">
          <p>
            By booking, visiting, or using the Escape Room Mystery website and
            services, you agree to the following Terms and Conditions.
          </p>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Reservations and Payment
            </h2>

            <p>
              Reservations are subject to availability. Full payment may be
              required at the time of booking. Prices are subject to change
              without notice.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Cancellation and Rescheduling
            </h2>

            <p>
              Reservations may be changed or canceled up to 30 minutes before
              the scheduled game time. No-call, no-show reservations are not
              eligible for refunds.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Arrival Requirements
            </h2>

            <p>
              Guests should arrive approximately 15 minutes before their
              scheduled reservation time. Late arrivals may result in reduced
              game time or cancellation if scheduling constraints prevent
              accommodation.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Participation
            </h2>

            <p>
              Participants are expected to follow all instructions provided by
              staff. Escape Room Mystery reserves the right to refuse service or
              remove participants whose behavior is unsafe, disruptive, or
              inappropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Assumption of Risk
            </h2>

            <p>
              Participation in an escape room involves physical movement,
              problem-solving activities, and interaction with themed
              environments. Participants voluntarily assume all risks
              associated with participation.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Liability Limitation
            </h2>

            <p>
              To the maximum extent permitted by law, Escape Room Mystery shall
              not be liable for indirect, incidental, special, or consequential
              damages arising from use of its facilities, website, or services.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Website Use
            </h2>

            <p>
              Users may not attempt to interfere with the operation, security,
              or functionality of the website or related systems.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Intellectual Property
            </h2>

            <p>
              Website content, room designs, graphics, branding, text, and
              other materials are the property of Escape Room Mystery and may
              not be copied or reproduced without permission.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Changes to These Terms
            </h2>

            <p>
              Escape Room Mystery may update these Terms and Conditions at any
              time. Updated versions will be posted on this page with a revised
              effective date.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-2xl font-black">
              Contact Information
            </h2>

            <div className="space-y-4">
              <div>
                <div className="font-black">
                  Escape Room Mystery - King of Prussia
                </div>
                <div>840 First Avenue, Suite 500</div>
                <div>King of Prussia, PA 19406</div>
              </div>

              <div>
                <div className="font-black">
                  Escape Room Mystery - Cherry Hill
                </div>
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