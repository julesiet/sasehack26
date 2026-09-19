import { z } from "zod";
import { auditEventSchema } from "./audit";
import { actors } from "./policy";
import { wearableReadingSchema } from "./seed";
import { appointmentSchema, caretakerUrgencySchema } from "./tools";

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

export const pendingApprovalSchema = z.object({
  tool: z.string(),
  input: z.unknown(),
  reason: z.string(),
  summary: z.string(),
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

export const sessionViewSchema = z.object({
  sessionId: z.string(),
  currentRequest: sessionRequestSchema.nullable(),
  pendingApproval: pendingApprovalSchema.nullable(),
  appointment: appointmentSchema.nullable(),
  lastBooking: sessionBookingSchema.nullable(),
  caretakerActivity: z.array(caretakerActivityItemSchema),
  careSignal: careSignalSchema.nullable(),
  consentGranted: z.boolean(),
  events: z.array(auditEventSchema),
});

export type SessionRequest = z.infer<typeof sessionRequestSchema>;
export type PendingApproval = z.infer<typeof pendingApprovalSchema>;
export type SessionBooking = z.infer<typeof sessionBookingSchema>;
export type CaretakerActivityItem = z.infer<typeof caretakerActivityItemSchema>;
export type CareSignal = z.infer<typeof careSignalSchema>;
export type SessionView = z.infer<typeof sessionViewSchema>;
