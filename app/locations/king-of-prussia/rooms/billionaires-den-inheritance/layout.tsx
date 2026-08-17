import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billionaire's Den Escape Room in King of Prussia, PA",
  description:
    "Take on The Billionaire's Den - Inheritance at Escape Room Mystery in King of Prussia, PA. Search for hidden clues, solve the final challenge, and claim the fortune before time runs out.",
};

export default function BillionairesDenKingOfPrussiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}