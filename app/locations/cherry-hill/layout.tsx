import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escape Rooms in Cherry Hill, NJ",
  description:
    "Book immersive escape rooms in Cherry Hill, NJ at Escape Room Mystery. Choose from Area 51, Egyptian Tomb, Billionaire's Den, Laboratory, and Witch's Cauldron.",
};

export default function CherryHillLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}