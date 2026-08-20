import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/book/",
        "/locations/king-of-prussia/book-now",
        "/locations/cherry-hill/book-now",
        "/gift-vouchers/checkout",
      ],
    },
    sitemap: "https://escaperoommystery.com/sitemap.xml",
  };
}