import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";

import {
    type BookingSession,
    type PaymentAttempt,
    type VerifiedPayment,
    type FinalizedBooking,
    type OrphanPayment,
    isValidBookingSessionId,
} from "../../lib/booking";

const redis = Redis.fromEnv();

const resend = new Resend(
    process.env.RESEND_API_KEY
);

const UNFINISHED_PAYMENT_ALERT_DELAY_MS =
    60 * 1000;

export async function POST(
    request: Request
) {
    try {
        const body =
            await request.json();

        const sessionId =
            String(
                body.sessionId || ""
            ).trim();

        if (
            !isValidBookingSessionId(
                sessionId
            )
        ) {
            return NextResponse.json(
                {
                    status:
                        "invalid",
                    error:
                        "Missing or invalid booking session ID.",
                },
                { status: 400 }
            );
        }

        const finalizedBooking =
            await redis.get<FinalizedBooking>(
                `bookeo-finalized:${sessionId}`
            );

        if (finalizedBooking) {
            let session =
                await redis.get<BookingSession>(
                    `booking-session:${sessionId}`
                );

            if (!session) {
                const paymentAttempt =
                    await redis.get<PaymentAttempt>(
                        `payment-attempt:${sessionId}`
                    );

                if (
                    paymentAttempt?.session
                        ?.sessionId ===
                    sessionId
                ) {
                    session =
                        paymentAttempt.session;
                }
            }

            const value =
                session
                    ? Number(session.total)
                    : NaN;

            const players =
                session
                    ? Number(
                        session.players
                    )
                    : NaN;

            const purchase =
                session &&
                    Number.isFinite(value) &&
                    value > 0 &&
                    Number.isInteger(players) &&
                    players > 0
                    ? {
                        transactionId:
                            finalizedBooking.transactionId,

                        value,

                        currency:
                            "USD" as const,

                        productId:
                            session.productId,

                        roomName:
                            session.roomName,

                        location:
                            session.location,

                        players,
                    }
                    : null;

            const response =
                NextResponse.json({
                    status:
                        "confirmed",

                    bookingId:
                        finalizedBooking.bookingId,

                    location:
                        session?.location || "",

                    purchase,
                });

            response.cookies.set(
                "erm_booking_resume",
                "",
                {
                    httpOnly: true,
                    secure:
                        process.env.NODE_ENV ===
                        "production",
                    sameSite: "lax",
                    path: "/",
                    maxAge: 0,
                }
            );

            return response;
        }

        const orphan =
            await redis.get<OrphanPayment>(
                `orphan-payment:${sessionId}`
            );

        if (
            orphan &&
            orphan.status ===
            "needs_recovery" &&
            orphan.failureType !==
            "payment_received_pending_finalization"
        ) {
            return NextResponse.json({
                status:
                    "needs_recovery",

                paymentReceived:
                    true,
            });
        }

        const verifiedPayment =
            await redis.get<VerifiedPayment>(
                `verified-payment:${sessionId}`
            );

        if (verifiedPayment) {
            return NextResponse.json({
                status:
                    "finalizing",

                paymentReceived:
                    true,
            });
        }

        const paymentAttempt =
            await redis.get<PaymentAttempt>(
                `payment-attempt:${sessionId}`
            );

        if (
            paymentAttempt?.status ===
            "paid"
        ) {
            const paymentAgeMs =
                Date.now() -
                paymentAttempt.updatedAt;

            if (
                paymentAgeMs >=
                UNFINISHED_PAYMENT_ALERT_DELAY_MS
            ) {
                const alertKey =
                    `unfinished-payment-alert:${sessionId}`;

                const claimed =
                    await redis.set(
                        alertKey,
                        "1",
                        {
                            nx: true,
                            ex: 60 * 60 * 24 * 30,
                        }
                    );

                if (claimed === "OK") {
                    try {
                        await resend.emails.send({
                            from:
                                "Escape Room Mystery <info@escaperoommystery.com>",

                            to:
                                "info@escaperoommystery.com",

                            subject:
                                `URGENT: Payment received but booking not confirmed - ${paymentAttempt.session.location}`,

                            text: `
A customer payment appears to have been received, but the Bookeo booking has not been confirmed after 60 seconds.

Customer: ${paymentAttempt.session.firstName} ${paymentAttempt.session.lastName}
Email: ${paymentAttempt.session.email}
Phone: ${paymentAttempt.session.phone}

Location: ${paymentAttempt.session.location}
Room: ${paymentAttempt.session.roomName}
Date: ${paymentAttempt.session.date}
Time: ${paymentAttempt.session.time}
Players: ${paymentAttempt.session.players}
Amount: $${paymentAttempt.session.total}

Booking session: ${sessionId}
Bookeo hold: ${paymentAttempt.session.holdId}

ACTION REQUIRED:
Check Authorize.Net and Bookeo before manually creating or refunding anything.
                            `.trim(),
                        });
                    } catch {
                        await redis.del(
                            alertKey
                        );
                    }
                }
            }

            return NextResponse.json({
                status:
                    "payment_received",

                paymentReceived:
                    true,
            });
        }

        return NextResponse.json({
            status:
                "waiting",
        });
    } catch {
        return NextResponse.json(
            {
                status:
                    "error",

                error:
                    "Could not check booking status.",
            },
            { status: 500 }
        );
    }
}