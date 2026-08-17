import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Witch's Cauldron Escape Room in Cherry Hill, NJ",
  description:
    "Experience Witch's Cauldron - Restoration at Escape Room Mystery in Cherry Hill, NJ. Decode magical symbols, recover lost ingredients, and restore the cauldron before time runs out.",
};

export default function WitchsCauldronCherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}