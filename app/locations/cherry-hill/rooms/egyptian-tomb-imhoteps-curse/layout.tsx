import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Egyptian Tomb Escape Room in Cherry Hill, NJ",
  description:
    "Explore Egyptian Tomb - Imhotep's Curse at Escape Room Mystery in Cherry Hill, NJ. Decode ancient symbols, uncover hidden secrets, and break the curse before time runs out.",
};

export default function EgyptianTombCherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}