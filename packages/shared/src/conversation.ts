import { z } from "zod";

/**
 * Voice conversation loop contracts (#4).
 *
 * The senior speaks → the app transcribes → `POST /conversation/turn` →
 * Kasama replies with text the device speaks aloud. The session keeps the
 * active request so Maria never has to repeat context between turns.
 */

/** Kasama asks at most this many clarifying questions per request. */
export const MAX_CLARIFICATIONS_PER_REQUEST = 1;

export const conversationSpeakerSchema = z.enum(["senior", "kasama"]);
export type ConversationSpeaker = z.infer<typeof conversationSpeakerSchema>;

/**
 * - `answer`: Kasama answered or acknowledged; the turn is complete.
 * - `clarification`: Kasama asked one follow-up question and is waiting.
 * - `proposal`: Kasama proposed an action that still needs human approval (#8).
 */
export const conversationReplyKindSchema = z.enum(["answer", "clarification", "proposal"]);
export type ConversationReplyKind = z.infer<typeof conversationReplyKindSchema>;

export const conversationIntentSchema = z.enum(["ride", "appointment_info", "unknown"]);
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
  status: z.enum(["gathering", "proposed", "accepted"]),
});
export type ActiveRequest = z.infer<typeof activeRequestSchema>;

export const conversationStateSchema = z.object({
  turns: z.array(conversationTurnSchema),
  activeRequest: activeRequestSchema.nullable(),
  clarificationsAsked: z.number().int().nonnegative(),
});
export type ConversationState = z.infer<typeof conversationStateSchema>;

export function emptyConversationState(): ConversationState {
  return { turns: [], activeRequest: null, clarificationsAsked: 0 };
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
