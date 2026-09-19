import { DEMO_UBER_WAV_OPTION_ID, type LastApproval } from "./approval";
import { emptyConversationState, type ConversationState } from "./conversation";
import { getMariaSeedBundle } from "./seed";
import type { CaretakerActivityItem, SessionBooking } from "./session";
import type { Appointment, UberRideOption } from "./tools";

/** Confirmation id for the seeded WAV booking. Not a live Uber receipt. */
export const MARIA_DEMO_CONFIRMATION_ID = "UBER-WAV-SEED";

export type MariaDemoSession = {
  appointment: Appointment;
  lastRideOptions: UberRideOption[];
  lastBooking: SessionBooking;
  lastApproval: LastApproval;
  caretakerActivity: CaretakerActivityItem[];
  consentGranted: true;
  conversation: ConversationState;
};

/** Demo Uber rows the senior Chat already knows (UberX + WAV). */
export function getMariaDemoRideOptions(): UberRideOption[] {
  return [
    {
      optionId: "uberx_1",
      provider: "uber",
      product: "UberX",
      estimate: "$18.00",
      etaMinutes: 8,
      accessible: false,
    },
    {
      optionId: DEMO_UBER_WAV_OPTION_ID,
      provider: "uber",
      product: "WAV",
      estimate: "$24.50",
      etaMinutes: 12,
      accessible: true,
    },
  ];
}

/**
 * Starting projection for the iOS `default` session. Caretaker Overview,
 * senior Chat, and a future chat-history page all read this same object
 * from `GET /sessions/default`.
 */
export function getMariaDemoSession(referenceDate: Date = new Date()): MariaDemoSession {
  const seed = getMariaSeedBundle(referenceDate);
  const bookedAt =
    seed.conversationTurns.find((turn) => turn.speaker === "kasama")?.timestamp ??
    seed.appointment.start;

  return {
    appointment: {
      id: seed.appointment.id,
      title: seed.appointment.title,
      start: seed.appointment.start,
      end: seed.appointment.end,
      location: seed.appointment.destination,
    },
    lastRideOptions: getMariaDemoRideOptions(),
    lastBooking: {
      provider: "uber",
      optionId: DEMO_UBER_WAV_OPTION_ID,
      status: "booked",
      confirmationId: MARIA_DEMO_CONFIRMATION_ID,
      summary: `Uber WAV booked for $24.50. Confirmation ${MARIA_DEMO_CONFIRMATION_ID}.`,
      timestamp: bookedAt,
      consentGranted: true,
    },
    lastApproval: {
      tool: "book_ride",
      action: "book_ride",
      decision: "approved",
      actor: "senior",
      timestamp: bookedAt,
      summary: "Maria confirmed the wheelchair Uber.",
      prompt: "The Uber is $24.50. Should I book it?",
    },
    caretakerActivity: [
      {
        id: "seed_notify_1",
        timestamp: bookedAt,
        summary: "Maria's wheelchair Uber is booked for tomorrow.",
        urgency: "low",
        sent: false,
        preview: true,
      },
    ],
    consentGranted: true,
    conversation: {
      ...emptyConversationState(),
      turns: seed.conversationTurns,
    },
  };
}
