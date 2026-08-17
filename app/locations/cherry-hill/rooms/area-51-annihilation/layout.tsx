import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Area 51 Escape Room in Cherry Hill, NJ",
  description:
    "Enter Area 51 - Annihilation at Escape Room Mystery in Cherry Hill, NJ. Work together to uncover classified secrets and stop an alien threat before time runs out.",
};

export default function Area51CherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}