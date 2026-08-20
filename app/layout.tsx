import type { Metadata } from "next";
import ClarityAnalytics from "./components/ClarityAnalytics";
import GoogleAnalytics from "./components/GoogleAnalytics";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://escaperoommystery.com"
  ),

  title: {
    default:
      "Escape Rooms in King of Prussia & Cherry Hill | Escape Room Mystery",
    template:
      "%s | Escape Room Mystery",
  },

  description:
    "Immersive escape rooms in King of Prussia, PA and Cherry Hill, NJ. Explore cinematic sets, challenging puzzles, private rooms, parties, and team-building adventures.",

  openGraph: {
    type: "website",
    siteName:
      "Escape Room Mystery",
    title:
      "Escape Rooms in King of Prussia & Cherry Hill | Escape Room Mystery",
    description:
      "Immersive private escape room adventures in King of Prussia, PA and Cherry Hill, NJ.",
    url:
      "https://escaperoommystery.com",
  },

  twitter: {
    card:
      "summary_large_image",
    title:
      "Escape Room Mystery",
    description:
      "Immersive private escape rooms in King of Prussia, PA and Cherry Hill, NJ.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "Arial, sans-serif",
          backgroundColor:
            "#f8f8f8",
        }}
      >
        <ClarityAnalytics />
        <GoogleAnalytics />
        {children}
      </body>
    </html>
  );
}