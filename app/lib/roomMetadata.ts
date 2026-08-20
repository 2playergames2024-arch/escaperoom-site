import type { Metadata } from "next";

import {
  getLocationBySlug,
  getRoomBySlug,
  type LocationSlug,
} from "../data/locations";

export function createRoomMetadata(
  locationSlug: LocationSlug,
  roomSlug: string
): Metadata {
  const location =
    getLocationBySlug(locationSlug);

  const room =
    getRoomBySlug(
      locationSlug,
      roomSlug
    );

  if (!location || !room) {
    return {};
  }

  const title =
    `${room.name} Escape Room in ${location.shortName}, ${location.state}`;

  const description =
    `${room.description} Book ${room.name} at Escape Room Mystery in ${location.shortName}, ${location.state}. Private escape room adventures for your group.`;

  return {
    title,

    description,

    alternates: {
      canonical:
        room.detailHref,
    },

    openGraph: {
      type: "website",
      siteName:
        "Escape Room Mystery",
      title,
      description,
      url: room.detailHref,
    },

    twitter: {
      card:
        "summary_large_image",
      title,
      description,
    },
  };
}