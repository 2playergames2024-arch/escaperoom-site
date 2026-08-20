declare global {
  interface Window {
    clarity?: {
      (
        command: "event",
        eventName: string
      ): void;

      (
        command: "consent",
        consent: boolean
      ): void;
    };
  }
}

export function trackClarityEvent(
  eventName: string
) {
  if (
    typeof window !== "undefined" &&
    typeof window.clarity === "function"
  ) {
    window.clarity(
      "event",
      eventName
    );
  }
}