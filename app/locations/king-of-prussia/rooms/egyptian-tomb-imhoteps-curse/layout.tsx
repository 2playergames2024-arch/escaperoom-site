import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Egyptian Tomb Escape Room in King of Prussia, PA",
  description:
    "Explore Egyptian Tomb - Imhotep's Curse at Escape Room Mystery in King of Prussia, PA. Decode ancient symbols, uncover hidden secrets, and break the curse before time runs out.",
};

export default function EgyptianTombKingOfPrussiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}