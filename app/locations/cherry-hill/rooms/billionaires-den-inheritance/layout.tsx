import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billionaire's Den Escape Room in Cherry Hill, NJ",
  description:
    "Take on The Billionaire's Den - Inheritance at Escape Room Mystery in Cherry Hill, NJ. Search for hidden clues, solve the final challenge, and claim the fortune before time runs out.",
};

export default function BillionairesDenCherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}