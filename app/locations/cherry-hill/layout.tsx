import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escape Rooms in Cherry Hill, NJ",

  description:
    "Book immersive escape rooms in Cherry Hill, NJ at Escape Room Mystery. Choose from Area 51, Egyptian Tomb, Billionaire's Den, Laboratory, and Witch's Cauldron.",

  alternates: {
    canonical: "/locations/cherry-hill",
  },

  openGraph: {
    type: "website",
    title:
      "Escape Rooms in Cherry Hill, NJ | Escape Room Mystery",
    description:
      "Private escape room adventures in Cherry Hill, NJ, featuring Area 51, Egyptian Tomb, Billionaire's Den, Laboratory, and Witch's Cauldron.",
    url: "/locations/cherry-hill",
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",

  name: "Escape Room Mystery Cherry Hill",

  url:
    "https://escaperoommystery.com/locations/cherry-hill",

  telephone: "610-757-1053",

  address: {
    "@type": "PostalAddress",
    streetAddress: "1200 Haddonfield Road, 2nd Floor",
    addressLocality: "Cherry Hill",
    addressRegion: "NJ",
    postalCode: "08002",
    addressCountry: "US",
  },

  priceRange: "$$",
};

export default function CherryHillLayout({
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