export const LOCATIONS = {
  kingOfPrussia: {
    slug: "king-of-prussia",
    name: "Escape Room Mystery King of Prussia",
    taxRate: 0.10,

    rooms: {
      "Area 51 - Annihilation": {
        basePrice: 35,
      },

      "Egyptian Tomb - Imhotep's Curse": {
        basePrice: 35,
      },

      "Billionaire's Den - The Inheritance": {
        basePrice: 35,
      },

      "Revolution - Spies & Patriotism": {
        basePrice: 35,
      },
    },
  },

  cherryHill: {
    slug: "cherry-hill",
    name: "Escape Room Mystery Cherry Hill",
    taxRate: 0.06625,

    rooms: {
      "Area 51 - Annihilation": {
        basePrice: 35,
      },

      "Egyptian Tomb - Imhotep's Curse": {
        basePrice: 35,
      },

      "Billionaire's Den - The Inheritance": {
        basePrice: 35,
      },

      "Laboratory - Heisenberg's Poison": {
        basePrice: 35,
      },

      "Witch's Cauldron - Restoration": {
        basePrice: 35,
      },
    },
  },
} as const;