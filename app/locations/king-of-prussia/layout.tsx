import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escape Rooms in King of Prussia, PA",
  description:
    "Book immersive escape rooms in King of Prussia, PA at Escape Room Mystery. Choose from Area 51, Egyptian Tomb, Billionaire's Den, and Revolution Spies.",
};

export default function KingOfPrussiaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}