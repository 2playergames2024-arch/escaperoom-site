export const BOOKEO_PEOPLE_CATEGORY_ID = "Cadults";

const ROOM_BASE_PRICE = 37;

function formatRoomDisplayPrice(
  basePrice: number
) {
  return `$${basePrice.toFixed(2)}/ea`;
}

const ROOM_DISPLAY_PRICE =
  formatRoomDisplayPrice(
    ROOM_BASE_PRICE
  );

export const LOCATIONS = {
  kingOfPrussia: {
    slug: "king-of-prussia",
    name: "Escape Room Mystery King of Prussia",
    shortName: "King of Prussia",
    state: "PA",
    subtitle: "Moore Park",

    streetAddress: "840 First Avenue, Suite 500",
    cityStateZip: "King of Prussia, PA 19406",
    phone: "610-757-1053",

    homeHref: "/locations/king-of-prussia",
    roomsHref: "/locations/king-of-prussia#rooms",
    bookHref: "/locations/king-of-prussia/book-now",

    rooms: {
      "Area 51 - Annihilation": {
        slug: "area-51",
        name: "Area 51 - Annihilation",
        image: "/images/rooms/area51-homepage-01.jpg",
        detailHref:
          "/locations/king-of-prussia/rooms/area-51-annihilation",
        description:
          "Stop the Alien threat before it reaches Earth.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41554F7LMPE16D83D7375A",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "Egyptian Tomb - Imhotep's Curse": {
        slug: "egyptian-tomb",
        name: "Egyptian Tomb - Imhotep's Curse",
        image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
        detailHref:
          "/locations/king-of-prussia/rooms/egyptian-tomb-imhoteps-curse",
        description:
          "Break the Pharaoh’s curse before the tomb seals forever.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41554THHUPW16B65A50DFE",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "The Billionaire's Den - Inheritance": {
        slug: "billionaires-den",
        name: "The Billionaire's Den - Inheritance",
        image: "/images/rooms/billionaires-den-homepage-01.jpg",
        detailHref:
          "/locations/king-of-prussia/rooms/billionaires-den-inheritance",
        description:
          "Uncover the fortune hidden inside a Billionaire’s final challenge.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41554P7U97R16B65AEA1BD",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "Revolution Spies - Patriotism": {
        slug: "revolution-spies",
        name: "Revolution Spies - Patriotism",
        image: "/images/rooms/revolution-spies-homepage-01.jpg",
        detailHref:
          "/locations/king-of-prussia/rooms/revolution-spies-patriotism",
        description:
          "Outwit the enemy and help turn the tide of the Revolution.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "415543YNJHT16B658539FC",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },
    },
  },

  cherryHill: {
    slug: "cherry-hill",
    name: "Escape Room Mystery Cherry Hill",
    shortName: "Cherry Hill",
    state: "NJ",
    subtitle: "Garden State Park",

    streetAddress: "1200 Haddonfield Road, 2nd Floor",
    cityStateZip: "Cherry Hill, NJ 08002",
    phone: "610-757-1053",

    homeHref: "/locations/cherry-hill",
    roomsHref: "/locations/cherry-hill#rooms",
    bookHref: "/locations/cherry-hill/book-now",

    rooms: {
      "Area 51 - Annihilation": {
        slug: "area-51",
        name: "Area 51 - Annihilation",
        image: "/images/rooms/area51-homepage-01.jpg",
        detailHref:
          "/locations/cherry-hill/rooms/area-51-annihilation",
        description:
          "Stop the Alien threat before it reaches Earth.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41568F3JKPH16B65DD70C7",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "Egyptian Tomb - Imhotep's Curse": {
        slug: "egyptian-tomb",
        name: "Egyptian Tomb - Imhotep's Curse",
        image: "/images/rooms/egyptian-tomb-homepage-01.jpg",
        detailHref:
          "/locations/cherry-hill/rooms/egyptian-tomb-imhoteps-curse",
        description:
          "Break the Pharaoh’s curse before the tomb seals forever.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "415683XTPL616B65D30623",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "The Billionaire's Den - Inheritance": {
        slug: "billionaires-den",
        name: "The Billionaire's Den - Inheritance",
        image: "/images/rooms/billionaires-den-homepage-01.jpg",
        detailHref:
          "/locations/cherry-hill/rooms/billionaires-den-inheritance",
        description:
          "Uncover the fortune hidden inside a Billionaire’s final challenge.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41568FMYM9616B65CB42FB",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "Laboratory - Heisenberg's Poison": {
        slug: "laboratory",
        name: "Laboratory - Heisenberg's Poison",
        image: "/images/rooms/laboratory-homepage-01.jpg",
        detailHref:
          "/locations/cherry-hill/rooms/laboratory-heisenbergs-poison",
        description:
          "Find the antidote before Heisenberg’s deadly poison takes effect.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41568MH3EE616B65D8D27E",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },

      "Witch's Cauldron - Restoration": {
        slug: "witchs-cauldron",
        name: "Witch's Cauldron - Restoration",
        image: "/images/rooms/witchs-cauldron-homepage-01.jpg",
        detailHref:
          "/locations/cherry-hill/rooms/witchs-cauldron-restoration",
        description:
          "Restore the Witch’s magic before her enchanted world is lost forever.",
        basePrice: ROOM_BASE_PRICE,
        displayPrice: ROOM_DISPLAY_PRICE,
        productId: "41568WM3EWM19A03487C8D",
        minPlayers: 2,
        saturdayMinPlayers: 4,
        maxPlayers: 10,
      },
    },
  },
} as const;

export type LocationSlug =
  | typeof LOCATIONS.kingOfPrussia.slug
  | typeof LOCATIONS.cherryHill.slug;

export function getLocationBySlug(
  location: string
) {
  if (
    location ===
    LOCATIONS.kingOfPrussia.slug
  ) {
    return LOCATIONS.kingOfPrussia;
  }

  if (
    location ===
    LOCATIONS.cherryHill.slug
  ) {
    return LOCATIONS.cherryHill;
  }

  return null;
}

export function getRoomByProductId(
  locationSlug: string,
  productId: string
) {
  const location =
    getLocationBySlug(locationSlug);

  if (!location) {
    return null;
  }

  const rooms =
    Object.values(location.rooms);

  return (
    rooms.find(
      (room) =>
        room.productId === productId
    ) ?? null
  );
}

export function getRoomBySlug(
  locationSlug: string,
  roomSlug: string
) {
  const location =
    getLocationBySlug(locationSlug);

  if (!location) {
    return null;
  }

  const rooms =
    Object.values(location.rooms);

  return (
    rooms.find(
      (room) =>
        room.slug === roomSlug
    ) ?? null
  );
}