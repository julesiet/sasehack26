import { z } from "zod";
import { pendingApprovalSchema } from "./approval";
import { formatHospitalTimeLabel } from "./time-label";
import { toolNameSchema, uberProductSchema } from "./tools";

/**
 * Voice conversation loop contracts (#4).
 *
 * The senior speaks → the app transcribes → `POST /conversation/turn` →
 * Kasama replies with text the device speaks aloud. The session keeps the
 * active request so Maria never has to repeat context between turns.
 */

/** Kasama asks at most this many clarifying questions per request. */
export const MAX_CLARIFICATIONS_PER_REQUEST = 1;

/** ChatGPT may request at most this many tool rounds per turn. */
export const MAX_TOOL_ROUNDS_PER_TURN = 4;

export const conversationPlanStepStatusSchema = z.enum(["ok", "denied", "failed"]);
export type ConversationPlanStepStatus = z.infer<typeof conversationPlanStepStatusSchema>;

export const conversationPlanStepSchema = z.object({
  tool: toolNameSchema,
  status: conversationPlanStepStatusSchema,
  summary: z.string(),
  auditId: z.string().optional(),
});
export type ConversationPlanStep = z.infer<typeof conversationPlanStepSchema>;

export const conversationPlanSchema = z.object({
  steps: z.array(conversationPlanStepSchema),
});
export type ConversationPlan = z.infer<typeof conversationPlanSchema>;

export const conversationFailureKindSchema = z.enum(["retry", "handoff"]);
export type ConversationFailureKind = z.infer<typeof conversationFailureKindSchema>;

export const conversationFailureSchema = z.object({
  kind: conversationFailureKindSchema,
  tool: toolNameSchema.optional(),
  summary: z.string(),
});
export type ConversationFailure = z.infer<typeof conversationFailureSchema>;

export const conversationSpeakerSchema = z.enum(["senior", "kasama"]);
export type ConversationSpeaker = z.infer<typeof conversationSpeakerSchema>;

/**
 * - `answer`: Kasama answered or acknowledged; the turn is complete.
 * - `clarification`: Kasama asked one follow-up question and is waiting.
 * - `proposal`: Kasama proposed an action that still needs human approval (#6).
 */
export const conversationReplyKindSchema = z.enum(["answer", "clarification", "proposal"]);
export type ConversationReplyKind = z.infer<typeof conversationReplyKindSchema>;

export const conversationIntentSchema = z.enum([
  "ride",
  "appointment_info",
  "medication_reminder",
  "hospital_schedule",
  "family_update",
  "unknown",
]);
export type ConversationIntent = z.infer<typeof conversationIntentSchema>;

export const conversationTurnSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  speaker: conversationSpeakerSchema,
  text: z.string(),
  kind: conversationReplyKindSchema.optional(),
});
export type ConversationTurn = z.infer<typeof conversationTurnSchema>;

/** What Kasama currently believes Maria is asking for. Carried across turns. */
export const activeRequestSchema = z.object({
  intent: conversationIntentSchema,
  destination: z.string().optional(),
  /** ISO date (YYYY-MM-DD) Kasama resolved from words like "tomorrow". */
  date: z.string().optional(),
  appointmentId: z.string().optional(),
  product: uberProductSchema.optional(),
  medicationName: z.string().optional(),
  frequency: z.string().optional(),
  intervalDays: z.number().int().positive().optional(),
  placeName: z.string().optional(),
  distance: z.string().optional(),
  reason: z.string().optional(),
  timeLabel: z
    .string()
    .transform(formatHospitalTimeLabel)
    .optional(),
  status: z.enum(["gathering", "proposed", "accepted"]),
});
export type ActiveRequest = z.infer<typeof activeRequestSchema>;

export const conversationStateSchema = z.object({
  turns: z.array(conversationTurnSchema),
  activeRequest: activeRequestSchema.nullable(),
  clarificationsAsked: z.number().int().nonnegative(),
  /** Tools the harness ran on the latest turn. */
  plan: conversationPlanSchema.default({ steps: [] }),
  /** Set when the latest turn needs a retry or a family handoff. */
  failure: conversationFailureSchema.nullable().default(null),
});
export type ConversationState = z.infer<typeof conversationStateSchema>;

export function emptyConversationState(): ConversationState {
  return {
    turns: [],
    activeRequest: null,
    clarificationsAsked: 0,
    plan: { steps: [] },
    failure: null,
  };
}

/** `POST /conversation/turn` body. */
export const conversationTurnRequestSchema = z.object({
  transcript: z.string().trim().min(1),
  sessionId: z.string().min(1).optional(),
  actor: z.enum(["senior", "caretaker"]).default("senior"),
});
export type ConversationTurnRequest = z.infer<typeof conversationTurnRequestSchema>;

/** `POST /conversation/turn` response. */
export const conversationTurnResponseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  kind: conversationReplyKindSchema,
  activeRequest: activeRequestSchema.nullable(),
  clarificationsAsked: z.number().int().nonnegative(),
  plan: conversationPlanSchema.default({ steps: [] }),
  failure: conversationFailureSchema.nullable().default(null),
  /** Present when Kasama is waiting for a human yes/no on the iPhone. */
  pendingApproval: pendingApprovalSchema.nullable().default(null),
});
export type ConversationTurnResponse = z.infer<typeof conversationTurnResponseSchema>;

/** `POST /speech/transcribe` response. */
export const transcribeResponseSchema = z.object({
  transcript: z.string(),
});
export type TranscribeResponse = z.infer<typeof transcribeResponseSchema>;

/** Returned with 501 when the API has no speech-to-text key configured. */
export const transcribeUnavailableSchema = z.object({
  error: z.literal("stt_not_configured"),
  summary: z.string(),
});

/** `POST /speech/speak` body. Kasama's reply, spoken by ElevenLabs. */
export const speakRequestSchema = z.object({
  text: z.string().trim().min(1),
});
export type SpeakRequest = z.infer<typeof speakRequestSchema>;
