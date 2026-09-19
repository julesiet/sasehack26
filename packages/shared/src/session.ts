import { z } from "zod";
import { lastApprovalSchema, pendingApprovalSchema } from "./approval";
import { auditEventSchema } from "./audit";
import { conversationStateSchema } from "./conversation";
import { actors } from "./policy";
import { wearableReadingSchema } from "./seed";
import { appointmentSchema, caretakerUrgencySchema, hospitalVisitDetailsSchema, medicationReminderSchema, uberRideOptionSchema } from "./tools";

/** Used when `POST /tools/:name` omits `sessionId`. Documented default for polling. */
export const DEFAULT_SESSION_ID = "default";

export function resolveSessionId(sessionId?: string): string {
  return sessionId ?? DEFAULT_SESSION_ID;
}

export const sessionRequestSchema = z.object({
  tool: z.string(),
  input: z.unknown(),
  actor: z.enum(actors),
  timestamp: z.string(),
});

export const sessionBookingSchema = z.object({
  provider: z.literal("uber"),
  optionId: z.string(),
  status: z.enum(["pending_confirmation", "booked", "not_implemented"]),
  confirmationId: z.string().optional(),
  summary: z.string(),
  timestamp: z.string(),
  consentGranted: z.boolean(),
});

export const caretakerActivityItemSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  summary: z.string(),
  urgency: caretakerUrgencySchema.optional(),
  sent: z.boolean(),
  preview: z.boolean(),
});

export const careSignalSchema = z.object({
  label: z.literal("worth reviewing"),
  note: z.string(),
  source: z.literal("maria_seed"),
  flaggedConfusionCount: z.number().int().nonnegative(),
  wearable: wearableReadingSchema.optional(),
});

export const medicationReminderStatusSchema = z.enum([
  "proposed",
  "sync_failed",
  "saved",
  "cancelled",
]);

export const sessionMedicationReminderSchema = medicationReminderSchema.extend({
  status: medicationReminderStatusSchema,
  savedLocally: z.boolean().optional(),
});

export const hospitalVisitStatusSchema = z.enum(["proposed", "saved", "cancelled"]);

export const sessionHospitalVisitSchema = hospitalVisitDetailsSchema.extend({
  status: hospitalVisitStatusSchema,
});

export const seniorTaskKindSchema = z.enum(["medication_reminder", "hospital_visit"]);

export const seniorTaskSchema = z.object({
  id: z.string(),
  kind: seniorTaskKindSchema,
  title: z.string(),
  detail: z.string(),
  timestamp: z.string(),
  savedLocally: z.boolean().optional(),
});

export const sessionViewSchema = z.object({
  sessionId: z.string(),
  currentRequest: sessionRequestSchema.nullable(),
  pendingApproval: pendingApprovalSchema.nullable(),
  lastApproval: lastApprovalSchema.nullable().default(null),
  lastRideOptions: z.array(uberRideOptionSchema).default([]),
  appointment: appointmentSchema.nullable(),
  lastBooking: sessionBookingSchema.nullable(),
  lastMedicationReminder: sessionMedicationReminderSchema.nullable().default(null),
  lastHospitalVisit: sessionHospitalVisitSchema.nullable().default(null),
  tasks: z.array(seniorTaskSchema).default([]),
  caretakerActivity: z.array(caretakerActivityItemSchema),
  careSignal: careSignalSchema.nullable(),
  consentGranted: z.boolean(),
  /** Voice loop memory (#4): turns so far and the request Kasama is carrying. */
  conversation: conversationStateSchema,
  events: z.array(auditEventSchema),
});

export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export type SessionBooking = z.infer<typeof sessionBookingSchema>;
export type SessionMedicationReminder = z.infer<typeof sessionMedicationReminderSchema>;
export type SessionHospitalVisit = z.infer<typeof sessionHospitalVisitSchema>;
export type SeniorTask = z.infer<typeof seniorTaskSchema>;
export type CaretakerActivityItem = z.infer<typeof caretakerActivityItemSchema>;
export type CareSignal = z.infer<typeof careSignalSchema>;
export type SessionView = z.infer<typeof sessionViewSchema>;
