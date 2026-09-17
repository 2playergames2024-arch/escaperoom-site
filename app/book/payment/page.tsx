"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useState,
} from "react";
import {
  getLocationBySlug,
} from "../../data/locations";
import {
  type PaymentSession,
  isValidBookingSessionId,
} from "../../lib/booking";
import {
  trackClarityEvent,
} from "../../lib/clarity";

type AcceptOpaqueData = {
  dataDescriptor: string;
  dataValue: string;
};

type AcceptResponse = {
  messages: {
    resultCode: string;
    message: Array<{
      code: string;
      text: string;
    }>;
  };
  opaqueData?: AcceptOpaqueData;
};

declare global {
  interface Window {
    Accept?: {
      dispatchData: (
        secureData: {
          authData: {
            apiLoginID: string;
            clientKey: string;
          };
          cardData: {
            cardNumber: string;
            month: string;
            year: string;
            cardCode: string;
          };
        },
        callback: (response: AcceptResponse) => void
      ) => void;
    };
  }
}

function PaymentPageContent() {
  const searchParams = useSearchParams();

  const sessionId =
    searchParams.get("sessionId") || "";

  const validSessionId =
    isValidBookingSessionId(sessionId);

  const [session, setSession] =
    useState<PaymentSession | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isPaying, setIsPaying] =
    useState(false);

  const [error, setError] =
    useState("");

  const [cardNumber, setCardNumber] =
    useState("");

  const [expirationMonth, setExpirationMonth] =
    useState("");

  const [expirationYear, setExpirationYear] =
    useState("");

  const [cardCode, setCardCode] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      if (!validSessionId) {
        setError(
          "This booking session is missing or expired. Please start your booking again."
        );
        setIsLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/booking-session?sessionId=${encodeURIComponent(
            sessionId
          )}`,
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok || !data.session) {
          throw new Error(
            "This booking session could not be found or has expired."
          );
        }

        if (!cancelled) {
          setSession(data.session);

          trackClarityEvent(
            "payment_page_viewed"
          );

          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your booking."
          );

          setIsLoading(false);
        }
      }
    }

    loadSession();

    return () => {
      cancelled = true;
    };
  }, [sessionId, validSessionId]);

  async function handlePayNow() {
    if (
      isPaying ||
      !session ||
      !sessionId
    ) {
      return;
    }

    setIsPaying(true);
    setError("");

    try {
      const apiLoginID =
        process.env
          .NEXT_PUBLIC_AUTHORIZE_SANDBOX_LOGIN_ID;

      const clientKey =
        process.env
          .NEXT_PUBLIC_AUTHORIZE_SANDBOX_CLIENT_KEY;

      if (!apiLoginID || !clientKey) {
        throw new Error(
          "Authorize.Net sandbox credentials are not configured."
        );
      }

      if (!window.Accept) {
        throw new Error(
          "Secure payment library is not available. Please refresh and try again."
        );
      }

      const opaqueData =
        await new Promise<AcceptOpaqueData>(
          (resolve, reject) => {
            window.Accept!.dispatchData(
              {
                authData: {
                  apiLoginID,
                  clientKey,
                },
                cardData: {
                  cardNumber:
                    cardNumber.replace(/\s+/g, ""),
                  month:
                    expirationMonth.trim(),
                  year:
                    expirationYear.trim(),
                  cardCode:
                    cardCode.trim(),
                },
              },
              (response) => {
                if (
                  response.messages.resultCode ===
                  "Ok" &&
                  response.opaqueData
                ) {
                  resolve(response.opaqueData);
                  return;
                }

                const message =
                  response.messages.message
                    ?.map((item) => item.text)
                    .join(" ") ||
                  "Authorize.Net could not tokenize the card.";

                reject(new Error(message));
              }
            );
          }
        );

      console.log(
        "Accept.js sandbox token received.",
        {
          dataDescriptor:
            opaqueData.dataDescriptor,
          hasDataValue:
            Boolean(opaqueData.dataValue),
        }
      );

      trackClarityEvent(
        "payment_tokenized"
      );

      setError(
        "Sandbox card token created successfully."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't tokenize the card. Please try again."
      );
    } finally {
      setIsPaying(false);
    }
  }

  if (isLoading) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <p
          role="status"
          aria-live="polite"
          className="text-center font-black"
        >
          Loading your booking...
        </p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-2xl rounded-[18px] border-2 border-slate-950 p-8 text-center shadow-lg">
          <h1 className="text-3xl font-black">
            Booking Session Expired
          </h1>

          <p
            role="alert"
            className="mt-4 text-lg font-semibold text-red-700"
          >
            {error ||
              "Please start your booking again."}
          </p>

          <Link
            href="/"
            className="mt-8 inline-block rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600"
          >
            Start Again
          </Link>
        </section>
      </main>
    );
  }

  const locationConfig =
    getLocationBySlug(
      session.location
    );

  const bookingHref =
    locationConfig?.bookHref ?? "/";

  const formattedDate =
    new Date(
      `${session.date}T12:00:00`
    ).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const roomCharge =
    Number(session.roomCharge);

  const promotionDiscount =
    Number(session.promotionDiscount);

  const tax =
    Number(session.tax);

  const taxLabel =
    session.location === "king-of-prussia"
      ? "Amusement Tax"
      : "Sales Tax";

  const finalTotal =
    Number(session.total);

  return (
    <>
      <Script
        src="https://jstest.authorize.net/v1/Accept.js"
        strategy="afterInteractive"
      />
      <main className="min-h-screen bg-white px-6 py-16 text-slate-950">
        <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-8 shadow-lg">
          {/* <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Payment
        </p> */}

          <h1 className="mt-2 text-4xl font-black">
            Review
          </h1>

          <div className="mt-8 grid gap-3 text-lg font-bold">
            <p>
              Room: {session.roomName}
            </p>

            <p>
              Date: {formattedDate}
            </p>

            <p>
              Time: {session.time}
            </p>

            <p>
              Players: {session.players}
            </p>

            <div className="mt-4 border-t-2 border-slate-200 pt-4">
              <div className="flex justify-between">
                <span>
                  Room Charge
                </span>

                <span>
                  ${roomCharge.toFixed(2)}
                </span>
              </div>

              <div className="mt-2 flex justify-between">
                <span>
                  {taxLabel}
                </span>

                <span>
                  ${tax.toFixed(2)}
                </span>
              </div>

              {promotionDiscount > 0 && (
                <div className="mt-2 flex justify-between">
                  <span>
                    Promotion/Voucher
                  </span>

                  <span>
                    -$
                    {promotionDiscount.toFixed(
                      2
                    )}
                  </span>
                </div>
              )}

              <div className="mt-4 flex justify-between border-t-2 border-slate-300 pt-4 text-2xl font-black">
                <span>
                  Amount Due
                </span>

                <span>
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-lg border-2 border-orange-500 bg-orange-50 p-6">
            <h2 className="text-2xl font-black text-orange-600">
              Escape Room Mystery Promise
            </h2>

            <p className="mt-4 text-lg font-black">
              Life happens. We&apos;ve got you covered.
            </p>

            <p className="mt-2 text-lg font-black">
              No hassle. No stress.
            </p>

            <p className="mt-4 text-lg leading-8">
              If something comes up, just call us{" "}
              <strong>
                any time before your scheduled game
              </strong>
              . We&apos;ll take care of you.
            </p>
          </div>

          <div className="mt-8 grid gap-4">
            <div>
              <label
                htmlFor="cardNumber"
                className="mb-2 block font-black"
              >
                Card Number
              </label>

              <input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) =>
                  setCardNumber(event.target.value)
                }
                className="w-full rounded border-2 border-slate-300 px-4 py-3"
                placeholder="4111111111111111"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="expirationMonth"
                  className="mb-2 block font-black"
                >
                  Month
                </label>

                <input
                  id="expirationMonth"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  value={expirationMonth}
                  onChange={(event) =>
                    setExpirationMonth(
                      event.target.value
                    )
                  }
                  className="w-full rounded border-2 border-slate-300 px-4 py-3"
                  placeholder="12"
                />
              </div>

              <div>
                <label
                  htmlFor="expirationYear"
                  className="mb-2 block font-black"
                >
                  Year
                </label>

                <input
                  id="expirationYear"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  value={expirationYear}
                  onChange={(event) =>
                    setExpirationYear(
                      event.target.value
                    )
                  }
                  className="w-full rounded border-2 border-slate-300 px-4 py-3"
                  placeholder="28"
                />
              </div>

              <div>
                <label
                  htmlFor="cardCode"
                  className="mb-2 block font-black"
                >
                  CVV
                </label>

                <input
                  id="cardCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  value={cardCode}
                  onChange={(event) =>
                    setCardCode(event.target.value)
                  }
                  className="w-full rounded border-2 border-slate-300 px-4 py-3"
                  placeholder="123"
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="mt-6 rounded border border-red-500 bg-red-50 p-4 text-sm font-bold text-red-700"
            >
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handlePayNow}
            disabled={isPaying}
            className="mt-8 w-full rounded bg-orange-500 px-8 py-4 font-black uppercase text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPaying
              ? "Starting Payment..."
              : "Proceed to Checkout"}
          </button>

          <Link
            href={bookingHref}
            className="mt-6 inline-block text-sm font-black uppercase text-orange-500"
          >
            ← Change Room, Date, or Time
          </Link>
        </section>
      </main>
    </>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          Loading payment...
        </main>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}