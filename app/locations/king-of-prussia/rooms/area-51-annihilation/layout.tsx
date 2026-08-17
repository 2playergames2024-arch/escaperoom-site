import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area 51 Escape Room in King of Prussia, PA",
  description:
    "Enter Area 51 - Annihilation at Escape Room Mystery in King of Prussia, PA. Uncover classified secrets, connect hidden clues, and stop the alien threat before time runs out.",
};

export default function Area51KingOfPrussiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}