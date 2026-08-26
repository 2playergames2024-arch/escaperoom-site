import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import {
    type BookingSession,
    type PaymentAttempt,
    type VerifiedPayment,
    type FinalizedBooking,
    type OrphanPayment,
    isValidBookingSessionId,
} from "../../lib/booking";

const redis = Redis.fromEnv();

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

            return NextResponse.json({
                status:
                    "confirmed",

                bookingId:
                    finalizedBooking.bookingId,

                location:
                    session?.location || "",

                purchase,
            });
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