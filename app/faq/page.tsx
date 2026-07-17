import SupportFooter from "@/app/components/SupportFooter";
import SupportHeader from "@/app/components/SupportHeader";

const faqs = [
  {
    question: "Are your escape rooms private?",
    answer:
      "Yes. Every booking at Escape Room Mystery is private to your group. You will never be paired with strangers. Whether you have two players or ten, the adventure is reserved exclusively for your group.",
  },
  {
    question: "What ages can participate?",
    answer:
      "Our adventures are designed to be enjoyable for a wide range of ages. Children 12 and under must be accompanied by an adult during the adventure.",
  },
  {
    question: "What time should I arrive?",
    answer:
      "Please arrive 15 minutes before your scheduled game time. This allows time for check-in, waivers, and your game briefing. If you are running late, please call us as soon as possible. We will do our best to accommodate late arrivals whenever possible, but game time may be reduced if necessary.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Tickets are $35 per player plus applicable taxes. Your final price will always be displayed before payment is completed.",
  },
  {
    question: "What is your cancellation policy?",
    answer:
      "We are a small company, and we understand that traffic, illness, weather, and schedule changes happen. Reservations may be changed or cancelled up to 30 minutes before your scheduled game time. Reservations that are not cancelled at least 30 minutes before the scheduled start time, including no-call/no-show reservations, are not eligible for refunds.",
  },
  {
    question: "How many players do you recommend?",
    answer:
      "Most groups enjoy our adventures with 4–8 players. Our rooms are large for the industry and can comfortably accommodate up to 10 players. Most of our adventures can be enjoyed by two players. However, we recommend at least three players for Egyptian Tomb, The Laboratory and Billionaire's Den, and four players often provide the best experience. Egyptian Tomb and The Laboratory contains puzzles designed for three or more participants. If your group has only two players, your game master can assist when needed so you can still enjoy the adventure. For large groups, birthdays, and team-building events, we have successfully accommodated groups as large as 16 players in a single room.",
  },
  {
    question: "Am I really locked in?",
    answer:
      "No. You may leave your adventure at any time. Whether you need a restroom break or simply want to step out for a moment, you're always in control.",
  },
  {
    question: "What about parking?",
    answer:
      "Parking at both our King of Prussia and Cherry Hill locations is free.",
  },
  {
    question: "Can I add tickets after purchase?",
    answer:
      "Absolutely! You may add additional players at any time before your game, including when you arrive. If you're still finalizing your group, you can reserve your game now and add additional players later.",
  },
];

export default function FAQPage() {
  return (
    <>
      <SupportHeader />
    <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
      <section className="mx-auto max-w-4xl">
        <p className="text-sm font-black uppercase tracking-[0.25em] text-orange-500">
          Escape Room Mystery
        </p>

        <h1 className="mt-3 text-5xl font-black">Frequently Asked Questions</h1>

        <p className="mt-5 text-lg font-semibold text-slate-600">
          Answers to the most common questions about booking and playing our
          private escape room adventures.
        </p>

        <div className="mt-10 grid gap-5">
          {faqs.map((faq) => (
            <section
              key={faq.question}
              className="rounded-[18px] border-2 border-slate-950 bg-white p-6 shadow-lg"
            >
              <h2 className="text-2xl font-black">{faq.question}</h2>
              <p className="mt-4 text-base font-semibold leading-7 text-slate-700">
                {faq.answer}
              </p>
            </section>
          ))}
        </div>
      </section>
    </main>
    <SupportFooter />
    </>
  );
}