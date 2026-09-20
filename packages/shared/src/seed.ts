import { z } from "zod";
import { conversationChatSchema, conversationTurnSchema, type ConversationChat, type ConversationTurn } from "./conversation";
import { caretakerUrgencySchema } from "./tools";

/**
 * Maria's demo fixtures (#2). Lets Kasama load a care-aware senior profile,
 * appointment, caretaker rules, wearable trend, and request history without
 * live partner APIs. Dates are computed relative to a reference date so the
 * demo stays valid whenever it runs.
 */

export const seniorProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  preferredLanguage: z.string(),
  communicationPreferences: z.object({
    speaksSlowly: z.boolean(),
    prefersSimpleLanguage: z.boolean(),
    repeatsConfirmations: z.boolean(),
  }),
  accessibilityNeeds: z.array(z.string()),
});
export type SeniorProfile = z.infer<typeof seniorProfileSchema>;

export const MARIA_PROFILE: SeniorProfile = seniorProfileSchema.parse({
  id: "senior_maria",
  name: "Maria Alvarez",
  preferredLanguage: "en-US",
  communicationPreferences: {
    speaksSlowly: true,
    prefersSimpleLanguage: true,
    repeatsConfirmations: true,
  },
  accessibilityNeeds: ["large_text", "hearing_aid_compatible", "uses_walker"],
});

export const seedAppointmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  pickup: z.string(),
  destination: z.string(),
});
export type SeedAppointment = z.infer<typeof seedAppointmentSchema>;

/** Maria's doctor appointment, tomorrow at 10:30 relative to `referenceDate`. */
export function getMariaAppointment(referenceDate: Date = new Date()): SeedAppointment {
  const start = new Date(referenceDate);
  start.setDate(start.getDate() + 1);
  start.setHours(10, 30, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 30);

  return seedAppointmentSchema.parse({
    id: "appt_maria_doctor_01",
    title: "Dr. Chen — annual checkup",
    start: start.toISOString(),
    end: end.toISOString(),
    pickup: "412 Willow Lane, Springfield",
    destination: "Springfield Family Medicine, 88 Oak St, Springfield",
  });
}

/** Closest hospital in the senior-chat mock (#41). Not live EHR. */
export const MARIA_NEARBY_HOSPITAL = {
  id: "hospital_st_marys",
  placeName: "St. Mary's Hospital",
  distance: "0.8 miles away",
} as const;

/** Pickup time to arrive `leadMinutes` before the appointment (default 15). */
export function computeArrivalTarget(
  appointment: SeedAppointment,
  leadMinutes = 15,
): string {
  const target = new Date(appointment.start);
  target.setMinutes(target.getMinutes() - leadMinutes);
  return target.toISOString();
}

export const escalationRuleSchema = z.object({
  id: z.string(),
  condition: z.string(),
  urgency: caretakerUrgencySchema,
  action: z.string(),
});
export type EscalationRule = z.infer<typeof escalationRuleSchema>;

export const caretakerPreferencesSchema = z.object({
  caretakerId: z.string(),
  name: z.string(),
  relationship: z.string(),
  contactMethod: z.enum(["sms", "call", "app_notification"]),
  quietHours: z.object({ start: z.string(), end: z.string() }),
  escalationRules: z.array(escalationRuleSchema),
});
export type CaretakerPreferences = z.infer<typeof caretakerPreferencesSchema>;

export const MARIA_CARETAKER_PREFERENCES: CaretakerPreferences =
  caretakerPreferencesSchema.parse({
    caretakerId: "caretaker_james",
    name: "James Alvarez",
    relationship: "son",
    contactMethod: "app_notification",
    quietHours: { start: "21:00", end: "07:00" },
    escalationRules: [
      {
        id: "escalation_missed_confirmation",
        condition:
          "Maria does not confirm a ride within 10 minutes of the scheduled pickup window",
        urgency: "high",
        action: "notify_caretaker",
      },
      {
        id: "escalation_repeated_confusion",
        condition:
          "Two or more repeated-confusion markers occur within the same day",
        urgency: "normal",
        action: "notify_caretaker",
      },
      {
        id: "escalation_ride_booked",
        condition: "A ride is successfully booked",
        urgency: "low",
        action: "notify_caretaker",
      },
    ],
  });

export const wearableReadingSchema = z.object({
  date: z.string(),
  sleepHours: z.number(),
  steps: z.number(),
  restingHeartRate: z.number(),
});
export type WearableReading = z.infer<typeof wearableReadingSchema>;

const WEARABLE_TREND = [
  { sleepHours: 6.8, steps: 2100, restingHeartRate: 72 },
  { sleepHours: 7.1, steps: 2400, restingHeartRate: 70 },
  { sleepHours: 5.9, steps: 1500, restingHeartRate: 76 },
  { sleepHours: 6.5, steps: 1900, restingHeartRate: 74 },
  { sleepHours: 7.4, steps: 2600, restingHeartRate: 69 },
  { sleepHours: 6.2, steps: 1700, restingHeartRate: 75 },
  { sleepHours: 6.9, steps: 2000, restingHeartRate: 73 },
] as const;

/** Last 7 days of sleep/activity readings, oldest first, ending `referenceDate`. */
export function getMariaWearableReadings(
  referenceDate: Date = new Date(),
): WearableReading[] {
  const days = WEARABLE_TREND.length;
  return WEARABLE_TREND.map((reading, index) => {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - (days - 1 - index));
    return wearableReadingSchema.parse({
      date: d.toISOString().slice(0, 10),
      ...reading,
    });
  });
}

export const priorRequestSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  requestText: z.string(),
  flaggedConfusion: z.boolean(),
  note: z.string().optional(),
});
export type PriorRequest = z.infer<typeof priorRequestSchema>;

/** Recent request history, including repeated-confusion markers for the care-signal insight. */
export function getMariaPriorRequests(
  referenceDate: Date = new Date(),
): PriorRequest[] {
  const yesterday = new Date(referenceDate);
  yesterday.setDate(yesterday.getDate() - 1);

  const at = (hours: number, minutes: number) => {
    const d = new Date(yesterday);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  return [
    priorRequestSchema.parse({
      id: "req_1",
      timestamp: at(9, 5),
      requestText: "Can you call me a ride to the doctor?",
      flaggedConfusion: false,
    }),
    priorRequestSchema.parse({
      id: "req_2",
      timestamp: at(9, 9),
      requestText: "Wait, did I already ask you to book the ride?",
      flaggedConfusion: true,
      note: "Asked the same question twice within 5 minutes.",
    }),
    priorRequestSchema.parse({
      id: "req_3",
      timestamp: at(9, 40),
      requestText: "What time is my appointment again?",
      flaggedConfusion: true,
      note: "Third time asking within the hour.",
    }),
  ];
}

export const familyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  initial: z.string().min(1),
});
export type FamilyContact = z.infer<typeof familyContactSchema>;

export const dashboardViewerSchema = z.object({
  firstName: z.string(),
  relationship: z.string(),
});
export type DashboardViewer = z.infer<typeof dashboardViewerSchema>;

/** Person signed into caretaker mode on the designed dashboard (#9). */
export const MARIA_DASHBOARD_VIEWER: DashboardViewer = dashboardViewerSchema.parse({
  firstName: "Margaret",
  relationship: "family",
});

/** Family row on the caretaker dashboard. James is also the policy caretaker. */
export const MARIA_FAMILY_CONTACTS: FamilyContact[] = [
  familyContactSchema.parse({ id: "contact_sarah", name: "Sarah", initial: "S" }),
  familyContactSchema.parse({ id: "contact_james", name: "James", initial: "J" }),
  familyContactSchema.parse({ id: "contact_emily", name: "Emily", initial: "E" }),
];

/** Same-day times for the seeded Maria ↔ Kasama ride thread. */
function atTime(referenceDate: Date, hours: number, minutes: number): string {
  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** Seeded Chat / caretaker activity for the iOS `default` session. */
export const MARIA_DEMO_CHAT_HOSPITAL_ID = "chat_hospital";
export const MARIA_DEMO_CHAT_MEDICATION_ID = "chat_medication";
export const MARIA_DEMO_CHAT_RIDE_ID = "chat_ride";

/**
 * Seeded Chat / caretaker activity for the iOS `default` session.
 * Chat history UI must read these turns from the session — do not fork a second store.
 */
export function getMariaDemoConversationTurns(
  referenceDate: Date = new Date(),
): ConversationTurn[] {
  return [
    conversationTurnSchema.parse({
      id: "seed_turn_1",
      timestamp: atTime(referenceDate, 8, 42),
      speaker: "senior",
      text: "Please get me a ride to my doctor tomorrow.",
    }),
    conversationTurnSchema.parse({
      id: "seed_turn_2",
      timestamp: atTime(referenceDate, 8, 47),
      speaker: "kasama",
      text: "I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-SEED.",
      kind: "answer",
    }),
    conversationTurnSchema.parse({
      id: "seed_turn_3",
      timestamp: atTime(referenceDate, 9, 5),
      speaker: "senior",
      text: "Thanks Kasama, that helps a lot. I'll be ready by 2:00.",
    }),
  ];
}

function getMariaDemoHospitalTurns(referenceDate: Date): ConversationTurn[] {
  return [
    conversationTurnSchema.parse({
      id: "seed_hospital_1",
      timestamp: atTime(referenceDate, 7, 10),
      speaker: "senior",
      text: "Schedule an appointment at St. Mary's for my annual physical.",
    }),
    conversationTurnSchema.parse({
      id: "seed_hospital_2",
      timestamp: atTime(referenceDate, 7, 12),
      speaker: "kasama",
      text: "I saved the appointment details for St. Mary's Hospital. That's Thursday at 10:00 AM.",
      kind: "answer",
    }),
    conversationTurnSchema.parse({
      id: "seed_hospital_3",
      timestamp: atTime(referenceDate, 7, 15),
      speaker: "senior",
      text: "Thank you.",
    }),
  ];
}

function getMariaDemoMedicationTurns(referenceDate: Date): ConversationTurn[] {
  return [
    conversationTurnSchema.parse({
      id: "seed_med_1",
      timestamp: atTime(referenceDate, 7, 38),
      speaker: "senior",
      text: "Remind me to take Lisinopril every 4 days.",
    }),
    conversationTurnSchema.parse({
      id: "seed_med_2",
      timestamp: atTime(referenceDate, 7, 40),
      speaker: "kasama",
      text: "I saved the Lisinopril reminder. It is on your Tasks list. Kasama did not change any medication.",
      kind: "answer",
    }),
    conversationTurnSchema.parse({
      id: "seed_med_3",
      timestamp: atTime(referenceDate, 7, 42),
      speaker: "senior",
      text: "Thanks.",
    }),
  ];
}

/** Oldest first. History UI sorts newest-first from last-turn time. */
export function getMariaDemoChats(referenceDate: Date = new Date()): ConversationChat[] {
  return [
    conversationChatSchema.parse({
      id: MARIA_DEMO_CHAT_HOSPITAL_ID,
      title: "Hospital visit",
      intent: "hospital_schedule",
      startedAt: atTime(referenceDate, 7, 10),
      turns: getMariaDemoHospitalTurns(referenceDate),
    }),
    conversationChatSchema.parse({
      id: MARIA_DEMO_CHAT_MEDICATION_ID,
      title: "Medication reminder",
      intent: "medication_reminder",
      startedAt: atTime(referenceDate, 7, 38),
      turns: getMariaDemoMedicationTurns(referenceDate),
    }),
    conversationChatSchema.parse({
      id: MARIA_DEMO_CHAT_RIDE_ID,
      title: "Doctor ride",
      intent: "ride",
      startedAt: atTime(referenceDate, 8, 42),
      turns: getMariaDemoConversationTurns(referenceDate),
    }),
  ];
}

export const mariaSeedBundleSchema = z.object({
  profile: seniorProfileSchema,
  appointment: seedAppointmentSchema,
  arrivalTarget: z.string(),
  caretakerPreferences: caretakerPreferencesSchema,
  wearableReadings: z.array(wearableReadingSchema),
  priorRequests: z.array(priorRequestSchema),
  dashboardViewer: dashboardViewerSchema,
  familyContacts: z.array(familyContactSchema),
  conversationTurns: z.array(conversationTurnSchema),
  conversationChats: z.array(conversationChatSchema),
});
export type MariaSeedBundle = z.infer<typeof mariaSeedBundleSchema>;

/** Single entry point for every consumer (API tools, caretaker dashboard, care-signal insights). */
export function getMariaSeedBundle(referenceDate: Date = new Date()): MariaSeedBundle {
  const appointment = getMariaAppointment(referenceDate);
  return mariaSeedBundleSchema.parse({
    profile: MARIA_PROFILE,
    appointment,
    arrivalTarget: computeArrivalTarget(appointment),
    caretakerPreferences: MARIA_CARETAKER_PREFERENCES,
    wearableReadings: getMariaWearableReadings(referenceDate),
    priorRequests: getMariaPriorRequests(referenceDate),
    dashboardViewer: MARIA_DASHBOARD_VIEWER,
    familyContacts: MARIA_FAMILY_CONTACTS,
    conversationTurns: getMariaDemoConversationTurns(referenceDate),
    conversationChats: getMariaDemoChats(referenceDate),
  });
}
