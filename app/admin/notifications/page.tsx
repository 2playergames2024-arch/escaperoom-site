import type { Metadata } from "next";
import NotificationAdminClient from "./NotificationAdminClient";

export const metadata: Metadata = {
  title: "Booking Notification Administration",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function NotificationAdminPage() {
  return <NotificationAdminClient />;
}
