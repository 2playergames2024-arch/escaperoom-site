import type { NextConfig } from "next";

const requiredProductionEnv = [
  "BOOKEO_KOP_API_KEY",
  "BOOKEO_CH_API_KEY",
  "BOOKEO_SECRET_KEY",
  "AUTHORIZE_LOGIN_ID",
  "AUTHORIZE_TRANSACTION_KEY",
  "AUTHORIZE_SIGNATURE_KEY",
  "AUTHORIZE_ENVIRONMENT",
  "SITE_URL",
  "RESEND_API_KEY",
  "ADMIN_RECOVERY_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
] as const;

if (process.env.NODE_ENV === "production") {
  const missing = requiredProductionEnv.filter(
    (name) => !process.env[name]?.trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required production environment variables: ${missing.join(
        ", "
      )}`
    );
  }

  const authorizeEnvironment =
    process.env.AUTHORIZE_ENVIRONMENT;

  if (
    authorizeEnvironment !== "production" &&
    authorizeEnvironment !== "sandbox"
  ) {
    throw new Error(
      "AUTHORIZE_ENVIRONMENT must be either production or sandbox."
    );
  }

  let siteUrl: URL;

  try {
    siteUrl =
      new URL(
        process.env.SITE_URL!
      );
  } catch {
    throw new Error(
      "SITE_URL must be a valid absolute URL."
    );
  }

  if (siteUrl.protocol !== "https:") {
    throw new Error(
      "SITE_URL must use HTTPS in production."
    );
  }

  if (
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error(
      "SITE_URL must be a clean HTTPS origin with no credentials, path, query string, or fragment."
    );
  }

  const canonicalProductionHosts =
    new Set([
      "escaperoommystery.com",
      "www.escaperoommystery.com",
    ]);

  if (
    canonicalProductionHosts.has(
      siteUrl.hostname.toLowerCase()
    ) &&
    authorizeEnvironment !==
      "production"
  ) {
    throw new Error(
      "The live Escape Room Mystery hostname requires AUTHORIZE_ENVIRONMENT=production."
    );
  }
}

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://bookeo.com https://*.bookeo.com https://www.clarity.ms https://*.clarity.ms https://www.googletagmanager.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://bookeo.com https://*.bookeo.com https://*.clarity.ms https://c.bing.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.g.doubleclick.net https://*.google.com https://pagead2.googlesyndication.com",
      "frame-src 'self' https://bookeo.com https://*.bookeo.com https://www.googletagmanager.com",
      "form-action 'self' https://accept.authorize.net https://test.authorize.net",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/kop-location",
        destination:
          "/locations/king-of-prussia",
        permanent: true,
      },
      {
        source: "/cherry-hill",
        destination:
          "/locations/cherry-hill",
        permanent: true,
      },
      {
        source:
          "/the-billionaires-den",
        destination:
          "/locations/king-of-prussia/rooms/billionaires-den-inheritance",
        permanent: true,
      },
      {
        source:
          "/the-egyptian-tomb",
        destination:
          "/locations/king-of-prussia/rooms/egyptian-tomb-imhoteps-curse",
        permanent: true,
      },
      {
        source:
          "/revolution-spies",
        destination:
          "/locations/king-of-prussia/rooms/revolution-spies-patriotism",
        permanent: true,
      },
      {
        source: "/area-51",
        destination:
          "/locations/king-of-prussia/rooms/area-51-annihilation",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/the-billionaires-den",
        destination:
          "/locations/cherry-hill/rooms/billionaires-den-inheritance",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/the-egyptian-tomb",
        destination:
          "/locations/cherry-hill/rooms/egyptian-tomb-imhoteps-curse",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/the-laboratory",
        destination:
          "/locations/cherry-hill/rooms/laboratory-heisenbergs-poison",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/area-51",
        destination:
          "/locations/cherry-hill/rooms/area-51-annihilation",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/witchescauldron",
        destination:
          "/locations/cherry-hill/rooms/witchs-cauldron-restoration",
        permanent: true,
      },
      {
        source:
          "/cherry-hill/book-your-adventure",
        destination:
          "/locations/cherry-hill/book-now",
        permanent: true,
      },
      {
        source:
          "/book-your-adventure",
        destination:
          "/locations/king-of-prussia/book-now",
        permanent: true,
      },
      {
        source: "/contact-us",
        destination: "/contact",
        permanent: true,
      },
      {
        source:
          "/about-escape-room-mystery",
        destination: "/faq",
        permanent: true,
      },

      // Old KOP gift-voucher URL
      {
        source:
          "/book-your-adventure/buy-a-voucher",
        destination:
          "/gift-vouchers/details?location=king-of-prussia",
        permanent: true,
      },

      // Old Cherry Hill gift-voucher URL
      {
        source:
          "/cherry-hill/buy-a-voucher",
        destination:
          "/gift-vouchers/details?location=cherry-hill",
        permanent: true,
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;