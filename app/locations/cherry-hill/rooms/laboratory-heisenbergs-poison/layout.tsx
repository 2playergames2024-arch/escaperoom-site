import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laboratory Escape Room in Cherry Hill, NJ",
  description:
    "Take on Laboratory - Heisenberg's Poison at Escape Room Mystery in Cherry Hill, NJ. Investigate experiments, uncover hidden clues, and find the antidote before time runs out.",
};

export default function LaboratoryCherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}