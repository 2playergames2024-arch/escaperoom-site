import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://escaperoommystery.com";

  return [
    {
      url: baseUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${baseUrl}/locations/king-of-prussia`,
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/locations/cherry-hill`,
      changeFrequency: "monthly",
      priority: 0.9,
    },

    {
      url: `${baseUrl}/locations/king-of-prussia/rooms/area-51-annihilation`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/king-of-prussia/rooms/egyptian-tomb-imhoteps-curse`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/king-of-prussia/rooms/billionaires-den-inheritance`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/king-of-prussia/rooms/revolution-spies-patriotism`,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    {
      url: `${baseUrl}/locations/cherry-hill/rooms/area-51-annihilation`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/cherry-hill/rooms/egyptian-tomb-imhoteps-curse`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/cherry-hill/rooms/billionaires-den-inheritance`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/cherry-hill/rooms/laboratory-heisenbergs-poison`,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locations/cherry-hill/rooms/witchs-cauldron-restoration`,
      changeFrequency: "monthly",
      priority: 0.8,
    },

    {
      url: `${baseUrl}/faq`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/contact`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/gift-vouchers/details`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}