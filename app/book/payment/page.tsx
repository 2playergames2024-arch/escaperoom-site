"use client";

import Link from "next/link";
import Script from "next/script";
import { useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
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

type PaymentNotice = {
  title: string;
  message: string;
  instruction: string;
};

type BookingConfirmation = {
  bookeoBookingId: string;
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

  const authorizeEnvironment =
    process.env
      .NEXT_PUBLIC_AUTHORIZE_ENVIRONMENT ===
      "production"
      ? "production"
      : "sandbox";

  const acceptJsUrl =
    authorizeEnvironment === "production"
      ? "https://js.authorize.net/v1/Accept.js"
      : "https://jstest.authorize.net/v1/Accept.js";

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

  const [paymentNotice, setPaymentNotice] =
    useState<PaymentNotice | null>(null);

  const [paymentLocked, setPaymentLocked] =
    useState(false);

  const [confirmation, setConfirmation] =
    useState<BookingConfirmation | null>(null);

  const [cardNumber, setCardNumber] =
    useState("");

  const [expirationMonth, setExpirationMonth] =
    useState("");

  const [expirationYear, setExpirationYear] =
    useState("");

  const [cardCode, setCardCode] =
    useState("");

  const [acceptReady, setAcceptReady] =
    useState(false);

  const paymentAttemptRef =
    useRef(false);

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
      paymentAttemptRef.current ||
      isPaying ||
      !session ||
      !sessionId
    ) {
      return;
    }

    paymentAttemptRef.current = true;
    setIsPaying(true);
    setError("");
    setPaymentNotice(null);

    let authorizationStarted =
      false;

    try {
      const authorizeEnvironment =
        process.env
          .NEXT_PUBLIC_AUTHORIZE_ENVIRONMENT ===
          "production"
          ? "production"
          : "sandbox";

      const apiLoginID =
        authorizeEnvironment ===
        "production"
          ? process.env
              .NEXT_PUBLIC_AUTHORIZE_LOGIN_ID
          : process.env
              .NEXT_PUBLIC_AUTHORIZE_SANDBOX_LOGIN_ID;

      const clientKey =
        authorizeEnvironment ===
        "production"
          ? process.env
              .NEXT_PUBLIC_AUTHORIZE_CLIENT_KEY
          : process.env
              .NEXT_PUBLIC_AUTHORIZE_SANDBOX_CLIENT_KEY;

      if (!apiLoginID || !clientKey) {
        throw new Error(
          `Authorize.Net ${authorizeEnvironment} public credentials are not configured.`
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
        "Accept.js payment token received.",
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

      authorizationStarted = true;
      setPaymentLocked(true);

      const authorizationResponse =
        await fetch(
          "/api/authorize/auth-only",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              sessionId,
              opaqueData,
            }),
          }
        );

      const authorizationData =
        await authorizationResponse.json();

      if (
        authorizationResponse.ok &&
        authorizationData.authorized &&
        authorizationData.booked &&
        authorizationData.captured &&
        authorizationData.complete &&
        authorizationData.bookeoBookingId
      ) {
        trackClarityEvent(
          "payment_authorized"
        );

        trackClarityEvent(
          "booking_completed"
        );

        setConfirmation({
          bookeoBookingId:
            String(
              authorizationData.bookeoBookingId
            ),
        });

        return;
      }

      if (
        authorizationData.unavailable
      ) {
        setPaymentNotice({
          title:
            "That Time Is No Longer Available",
          message:
            authorizationData.error ||
            "Unfortunately, those seats became unavailable before your booking could be completed.",
          instruction:
            "Close this message, then choose Change Room, Date, or Time below to select another available time.",
        });

        return;
      }

      if (
        authorizationData.declined
      ) {
        /*
         * A definite decline means Authorize.Net did
         * not approve an authorization. It is safe to
         * let the customer correct the card details and
         * submit again on this same booking session.
         */
        paymentAttemptRef.current = false;
        setPaymentLocked(false);

        setPaymentNotice({
          title:
            "Payment Was Not Approved",
          message:
            authorizationData.error ||
            "Your card was declined.",
          instruction:
            "Close this message, check your card information, or try another card.",
        });

        return;
      }

      if (
        authorizationData.recoveryRequired ||
        authorizationData.uncertain
      ) {
        setPaymentNotice({
          title:
            "We're Confirming Your Booking",
          message:
            "We received your payment request, but the final booking status could not be confirmed immediately.",
          instruction:
            "Please do not submit another payment. Close this message and contact us if you need assistance.",
        });

        return;
      }

      setPaymentNotice({
        title:
          "Booking Could Not Be Completed",
        message:
          authorizationData.error ||
          "We could not complete your booking.",
        instruction:
          "Close this message, then use Change Room, Date, or Time below to start again.",
      });
    } catch (err) {
      if (!authorizationStarted) {
        paymentAttemptRef.current = false;
        setPaymentLocked(false);
      }

      setPaymentNotice({
        title: authorizationStarted
          ? "Booking Could Not Be Confirmed"
          : "Card Information Could Not Be Submitted",
        message:
          err instanceof Error
            ? err.message
            : authorizationStarted
              ? "We could not confirm the final booking status."
              : "We could not securely submit the card information.",
        instruction: authorizationStarted
          ? "Please do not submit another payment. Close this message and contact us if you need assistance."
          : "Check the card information and try again.",
      });
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

  const locationName =
    session.location === "king-of-prussia"
      ? "King of Prussia"
      : session.location === "cherry-hill"
        ? "Cherry Hill"
        : "Escape Room Mystery";

  const locationDisplay =
    session.location === "king-of-prussia"
      ? "King of Prussia, PA"
      : session.location === "cherry-hill"
        ? "Cherry Hill, New Jersey"
        : "Escape Room Mystery";

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

  if (confirmation) {
    return (
      <main className="min-h-screen bg-white px-4 py-8 text-slate-950 sm:px-6">
        <section className="mx-auto max-w-2xl rounded-[18px] border-2 border-slate-950 p-6 shadow-lg sm:p-8">
          <div className="text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-3xl font-black text-white"
              aria-hidden="true"
            >
              ✓
            </div>

            <h1 className="mt-4 text-3xl font-black sm:text-4xl">
              Booking Confirmed
            </h1>

            <p className="mt-2 text-lg font-semibold">
              Thank you for your purchase.
            </p>

            <p className="mt-2 text-base text-slate-700 sm:text-lg">
              Your reservation for{" "}
              <strong>{session.roomName}</strong>{" "}
              is confirmed.
            </p>
          </div>

          <div className="mt-6 rounded-xl border-2 border-slate-200 p-5">
            <div className="grid gap-2 text-base sm:text-lg">
              <p>
                <strong>Location:</strong>{" "}
                {locationDisplay}
              </p>

              <p>
                <strong>Date:</strong>{" "}
                {formattedDate}
              </p>

              <p>
                <strong>Time:</strong>{" "}
                {session.time}
              </p>

              <p>
                <strong>Players:</strong>{" "}
                {session.players}
              </p>

              <p>
                <strong>Total Paid:</strong>{" "}
                ${finalTotal.toFixed(2)}
              </p>

              <p>
                <strong>
                  Confirmation Number:
                </strong>{" "}
                {confirmation.bookeoBookingId}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border-2 border-orange-500 bg-orange-50 p-5">
            <p className="font-bold">
              A confirmation email should arrive shortly with your booking details.
            </p>

            <p className="mt-2">
              If you do not see it, please check your spam or junk folder. Feel free to contact us and we can confirm your booking.
            </p>
          </div>

          <Link
            href={bookingHref}
            className="mt-6 block w-full rounded bg-orange-500 px-6 py-3.5 text-center font-black uppercase text-white hover:bg-orange-600"
          >
            Return to {locationName} Booking
          </Link>

          <Link
            href="/"
            className="mt-3 block text-center text-sm font-black uppercase text-orange-500"
          >
            Return to Home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <>
      <Script
        src={acceptJsUrl}
        strategy="afterInteractive"
        onReady={() => {
          setAcceptReady(true);
        }}
        onLoad={() => {
          setAcceptReady(true);
        }}
        onError={() => {
          setAcceptReady(false);
          setPaymentNotice({
            title:
              "Secure Payment Could Not Load",
            message:
              "The secure payment system did not load correctly.",
            instruction:
              "Close this message, refresh the page, and try again.",
          });
        }}
      />
      <main className="min-h-screen bg-white px-4 py-6 text-slate-950 sm:px-6 lg:py-4">
        <section className="mx-auto max-w-3xl rounded-[18px] border-2 border-slate-950 p-5 shadow-lg sm:p-6">
          {/* <p className="text-sm font-black uppercase tracking-[0.2em] text-orange-500">
          Payment
        </p> */}

          <h1 className="text-3xl font-black">
            Review &amp; Pay
          </h1>

          <p className="mt-1 text-base font-black text-slate-700 sm:text-lg">
            {locationDisplay}
          </p>

          <div className="mt-3 grid gap-1.5 text-base font-bold sm:text-lg">
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

            <div className="mt-3 border-t-2 border-slate-200 pt-3">
              <div className="flex justify-between">
                <span>
                  Room Charge
                </span>

                <span>
                  ${roomCharge.toFixed(2)}
                </span>
              </div>

              <div className="mt-1 flex justify-between">
                <span>
                  {taxLabel}
                </span>

                <span>
                  ${tax.toFixed(2)}
                </span>
              </div>

              {promotionDiscount > 0 && (
                <div className="mt-1 flex justify-between">
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

              <div className="mt-3 flex justify-between border-t-2 border-slate-300 pt-3 text-2xl font-black">
                <span>
                  Amount Due
                </span>

                <span>
                  ${finalTotal.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border-2 border-orange-500 bg-orange-50 p-4">
            <h2 className="text-xl font-black text-orange-600 sm:text-2xl">
              Escape Room Mystery Promise
            </h2>

            <p className="mt-2 text-base font-black sm:text-lg">
              Life happens. We&apos;ve got you covered.
            </p>

            <p className="mt-1 text-base font-black sm:text-lg">
              No hassle. No stress.
            </p>

            <p className="mt-2 text-base leading-6 sm:text-lg sm:leading-7">
              If something comes up, just call us{" "}
              <strong>
                any time before your scheduled game
              </strong>
              . We&apos;ll take care of you.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <label
                htmlFor="cardNumber"
                className="mb-1 block font-black"
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
                className="w-full rounded border-2 border-slate-300 px-4 py-2.5"
                placeholder="1234 5678 9012 3456"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="expirationMonth"
                  className="mb-1 block font-black"
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
                  className="w-full rounded border-2 border-slate-300 px-4 py-2.5"
                  placeholder="MM"
                />
              </div>

              <div>
                <label
                  htmlFor="expirationYear"
                  className="mb-1 block font-black"
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
                  className="w-full rounded border-2 border-slate-300 px-4 py-2.5"
                  placeholder="YY"
                />
              </div>

              <div>
                <label
                  htmlFor="cardCode"
                  className="mb-1 block font-black"
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
                  className="w-full rounded border-2 border-slate-300 px-4 py-2.5"
                  placeholder="123"
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePayNow}
            disabled={
              isPaying ||
              !acceptReady ||
              paymentLocked
            }
            className="mt-4 w-full rounded bg-orange-500 px-8 py-3.5 font-black uppercase text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPaying
              ? "Confirming Booking..."
              : !acceptReady
                ? "Loading Secure Payment..."
                : paymentLocked
                  ? "Payment Attempt Complete"
                  : `Pay $${finalTotal.toFixed(2)} & Complete Booking`}
          </button>

          <Link
            href={bookingHref}
            className="mt-3 inline-block text-sm font-black uppercase text-orange-500"
          >
            ← Change Room, Date, or Time
          </Link>
        </section>

        {paymentNotice && !isPaying && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-notice-title"
            aria-describedby="payment-notice-message"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8">
              <h2
                id="payment-notice-title"
                className="text-2xl font-black"
              >
                {paymentNotice.title}
              </h2>

              <p
                id="payment-notice-message"
                className="mt-3 text-base font-semibold text-slate-700"
              >
                {paymentNotice.message}
              </p>

              <p className="mt-3 text-sm text-slate-600">
                {paymentNotice.instruction}
              </p>

              <button
                type="button"
                onClick={() =>
                  setPaymentNotice(null)
                }
                className="mt-6 w-full rounded bg-orange-500 px-6 py-3 font-black uppercase text-white hover:bg-orange-600"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {isPaying && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
              <div
                className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-orange-500"
                aria-hidden="true"
              />

              <h2 className="mt-5 text-2xl font-black">
                Please do not leave this page
              </h2>

              <p className="mt-2 text-lg font-semibold text-slate-700">
                Confirming your booking...
              </p>
            </div>
          </div>
        )}
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
