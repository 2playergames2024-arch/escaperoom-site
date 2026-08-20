import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escape Rooms in King of Prussia, PA",

  description:
    "Book immersive escape rooms in King of Prussia, PA at Escape Room Mystery. Choose from Area 51, Egyptian Tomb, Billionaire's Den, and Revolution Spies.",

  alternates: {
    canonical: "/locations/king-of-prussia",
  },

  openGraph: {
    type: "website",
    title:
      "Escape Rooms in King of Prussia, PA | Escape Room Mystery",
    description:
      "Private escape room adventures in King of Prussia, PA, featuring Area 51, Egyptian Tomb, Billionaire's Den, and Revolution Spies.",
    url: "/locations/king-of-prussia",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",

  name: "Escape Room Mystery King of Prussia",

  url:
    "https://escaperoommystery.com/locations/king-of-prussia",

  telephone: "610-757-1053",

  address: {
    "@type": "PostalAddress",
    streetAddress: "840 First Avenue, Suite 500",
    addressLocality: "King of Prussia",
    addressRegion: "PA",
    postalCode: "19406",
    addressCountry: "US",
  },

  priceRange: "$$",
};

export default function KingOfPrussiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      {children}
    </>
  );
}