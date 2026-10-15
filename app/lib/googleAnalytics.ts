export const GA4_MEASUREMENT_ID =
  "G-14EQ8CHNWC";

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    gtag?: (
      command: string,
      ...args: unknown[]
    ) => void;
    __ermGa4Initialized?: boolean;
  }
}

export type Ga4Purchase = {
  transactionId: string;
  value: number;
  currency: "USD";
  productId: string;
  roomName: string;
  location: string;
  players: number;
};

export function ensureGoogleTag() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  window.dataLayer =
    window.dataLayer || [];

  if (
    typeof window.gtag !== "function"
  ) {
    window.gtag = function gtag() {
      window.dataLayer?.push(
        // eslint-disable-next-line prefer-rest-params
        arguments
      );
    };
  }

  if (
    window.__ermGa4Initialized
  ) {
    return;
  }

  window.gtag(
    "js",
    new Date()
  );

  window.gtag(
    "config",
    GA4_MEASUREMENT_ID,
    {
      send_page_view: false,
    }
  );

  window.__ermGa4Initialized =
    true;
}

export function trackGa4Purchase(
  purchase: Ga4Purchase
) {
  if (
    typeof window === "undefined" ||
    !purchase.transactionId ||
    !Number.isFinite(
      purchase.value
    ) ||
    purchase.value <= 0
  ) {
    return;
  }

  ensureGoogleTag();

  if (
    typeof window.gtag !== "function"
  ) {
    return;
  }

  window.gtag(
    "event",
    "purchase",
    {
      transaction_id:
        purchase.transactionId,
      value:
        purchase.value,
      currency:
        purchase.currency,

      /*
       * Do not send the real /book/confirm query string
       * because it contains the booking session ID.
       */
      page_location:
        "https://escaperoommystery.com/book/confirm",

      items: [
        {
          item_id:
            purchase.productId,
          item_name:
            purchase.roomName,
          item_category:
            purchase.location,
          quantity: 1,
          price:
            purchase.value,
          players:
            purchase.players,
        },
      ],
    }
  );
}

/** Report a confirmed, paid booking to the existing GA4 setup, GTM, and Meta. */
export function trackPurchase(purchase: Ga4Purchase) {
  if (
    typeof window === "undefined" ||
    !purchase.transactionId ||
    !Number.isFinite(purchase.value) ||
    purchase.value <= 0
  ) {
    return;
  }

  const key = `erm:purchase:${purchase.transactionId}`;
  try {
    if (window.sessionStorage.getItem(key) === "sent") return;
    window.sessionStorage.setItem(key, "sent");
  } catch {
    // Browsers can block storage. Still send the confirmed purchase.
  }

  trackGa4Purchase(purchase);

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event: "booking_purchase",
    ecommerce: {
      transaction_id: purchase.transactionId,
      value: purchase.value,
      currency: purchase.currency,
      items: [{
        item_id: purchase.productId,
        item_name: purchase.roomName,
        item_category: purchase.location,
        quantity: 1,
      }],
    },
  });

  if (typeof window.fbq === "function") {
    window.fbq("track", "Purchase", {
      value: purchase.value,
      currency: purchase.currency,
      content_ids: [purchase.productId],
      content_name: purchase.roomName,
      content_type: "product",
      num_items: 1,
    }, { eventID: purchase.transactionId });
  }
}
