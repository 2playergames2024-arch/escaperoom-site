export const BOOKING_STATES = {
  HOLD_CREATED: "HOLD_CREATED",
  AUTHORIZING: "AUTHORIZING",
  AUTHORIZED: "AUTHORIZED",
  BOOKED: "BOOKED",
  CAPTURE_FAILED: "CAPTURE_FAILED",
  COMPLETE: "COMPLETE",
  FAILED: "FAILED",
  VOIDED: "VOIDED",
} as const;

export type BookingState =
  (typeof BOOKING_STATES)[keyof typeof BOOKING_STATES];

const ALLOWED_TRANSITIONS: Record<
  BookingState,
  BookingState[]
> = {
  HOLD_CREATED: [
    "AUTHORIZING",
    "FAILED",
  ],

  AUTHORIZING: [
    "HOLD_CREATED",
    "AUTHORIZED",
    "FAILED",
  ],

  AUTHORIZED: [
    "BOOKED",
    "FAILED",
    "VOIDED",
  ],

  BOOKED: [
    "COMPLETE",
    "CAPTURE_FAILED",
  ],

  CAPTURE_FAILED: [
    "COMPLETE",
    "CAPTURE_FAILED",
  ],

  COMPLETE: [],

  FAILED: [],

  VOIDED: [],
};

export function canTransitionBookingState(
  currentState: BookingState,
  nextState: BookingState
) {
  return ALLOWED_TRANSITIONS[
    currentState
  ].includes(nextState);
}

export function assertBookingStateTransition(
  currentState: BookingState,
  nextState: BookingState
) {
  if (
    !canTransitionBookingState(
      currentState,
      nextState
    )
  ) {
    throw new Error(
      `Invalid booking state transition: ${currentState} -> ${nextState}`
    );
  }
}
