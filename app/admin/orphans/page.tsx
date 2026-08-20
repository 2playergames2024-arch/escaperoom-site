import type { Metadata } from "next";
import AdminOrphansClient from "./AdminOrphansClient";

export const metadata: Metadata = {
  title: "Booking Recovery Administration",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function AdminOrphansPage() {
  return <AdminOrphansClient />;
}