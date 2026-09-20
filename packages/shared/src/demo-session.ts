import { DEMO_UBER_WAV_OPTION_ID, type LastApproval } from "./approval";
import { emptyConversationState, type ConversationState } from "./conversation";
import { MARIA_NEARBY_HOSPITAL, MARIA_DEMO_CHAT_RIDE_ID, getMariaSeedBundle } from "./seed";
import type {
  CaretakerActivityItem,
  SeniorTask,
  SessionBooking,
  SessionHospitalVisit,
  SessionMedicationReminder,
} from "./session";
import type { Appointment, UberRideOption } from "./tools";

/** Confirmation id for the seeded WAV booking. Not a live Uber receipt. */
export const MARIA_DEMO_CONFIRMATION_ID = "UBER-WAV-SEED";

export type MariaDemoSession = {
  appointment: Appointment;
  lastRideOptions: UberRideOption[];
  lastBooking: SessionBooking;
  lastApproval: LastApproval;
  lastMedicationReminder: SessionMedicationReminder;
  lastHospitalVisit: SessionHospitalVisit;
  tasks: SeniorTask[];
  caretakerActivity: CaretakerActivityItem[];
  consentGranted: true;
  conversation: ConversationState;
};

/** Unbooked start for the live 3-minute demo (#12). History stays; the ride does not. */
export type MariaLiveDemoSession = Omit<
  MariaDemoSession,
  "lastBooking" | "lastApproval" | "consentGranted"
> & {
  lastBooking: null;
  lastApproval: null;
  consentGranted: false;
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
  const rideChat =
    seed.conversationChats.find((chat) => chat.id === MARIA_DEMO_CHAT_RIDE_ID) ??
    seed.conversationChats.at(-1);
  const bookedAt =
    seed.conversationTurns.find((turn) => turn.speaker === "kasama")?.timestamp ??
    seed.appointment.start;
  const reminderSavedAt =
    seed.conversationChats
      .find((chat) => chat.intent === "medication_reminder")
      ?.turns.find((turn) => turn.speaker === "kasama")?.timestamp ?? bookedAt;
  const hospitalSavedAt =
    seed.conversationChats
      .find((chat) => chat.intent === "hospital_schedule")
      ?.turns.find((turn) => turn.speaker === "kasama")?.timestamp ?? bookedAt;

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
    lastMedicationReminder: {
      name: "Lisinopril",
      frequency: "Every 4 days",
      intervalDays: 4,
      status: "saved",
      savedLocally: false,
    },
    lastHospitalVisit: {
      placeName: MARIA_NEARBY_HOSPITAL.placeName,
      distance: MARIA_NEARBY_HOSPITAL.distance,
      reason: "Annual physical",
      timeLabel: "Thursday at 10:00 AM",
      status: "saved",
    },
    tasks: [
      {
        id: "seed_task_lisinopril",
        kind: "medication_reminder",
        title: "Lisinopril",
        detail: "Every 4 days",
        timestamp: reminderSavedAt,
      },
      {
        id: "seed_task_st_marys",
        kind: "hospital_visit",
        title: MARIA_NEARBY_HOSPITAL.placeName,
        detail: "Annual physical · Thursday at 10:00 AM",
        timestamp: hospitalSavedAt,
      },
    ],
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
      chats: seed.conversationChats,
      activeChatId: rideChat?.id ?? MARIA_DEMO_CHAT_RIDE_ID,
      turns: rideChat?.turns ?? seed.conversationTurns,
    },
  };
}

/**
 * iOS `default` session for a live booking demo. Hospital + medication threads
 * stay so Chat and Tasks are not empty. The doctor-ride thread and WAV booking
 * are omitted so caretaker Overview starts idle and Maria can book on stage.
 */
export function getMariaLiveDemoSession(
  referenceDate: Date = new Date(),
): MariaLiveDemoSession {
  const seeded = getMariaDemoSession(referenceDate);
  const chats = seeded.conversation.chats.filter((chat) => chat.id !== MARIA_DEMO_CHAT_RIDE_ID);
  return {
    appointment: seeded.appointment,
    lastRideOptions: [],
    lastBooking: null,
    lastApproval: null,
    lastMedicationReminder: seeded.lastMedicationReminder,
    lastHospitalVisit: seeded.lastHospitalVisit,
    tasks: seeded.tasks,
    caretakerActivity: [],
    consentGranted: false,
    conversation: {
      ...emptyConversationState(),
      chats,
      activeChatId: null,
      turns: [],
    },
  };
}
