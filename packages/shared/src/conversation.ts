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

/** One titled thread on the session. History lists these; Chat opens one. */
export const conversationChatSchema = z.object({
  id: z.string(),
  title: z.string(),
  intent: conversationIntentSchema,
  startedAt: z.string(),
  turns: z.array(conversationTurnSchema),
});
export type ConversationChat = z.infer<typeof conversationChatSchema>;

/** What Kasama currently believes Maria is asking for. Carried across turns. */
export const activeRequestSchema = z.object({
  intent: conversationIntentSchema,
  destination: z.string().optional(),
  /** ISO date (YYYY-MM-DD) Kasama resolved from words like "tomorrow" or a spoken clock. */
  date: z.string().optional(),
  /** ISO datetime for the Uber arrive-by / pickup window Maria named. */
  arriveBy: z.string().optional(),
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
  /** Past and current threads. `turns` is always the active chat's turns. */
  chats: z.array(conversationChatSchema).default([]),
  activeChatId: z.string().nullable().default(null),
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
    chats: [],
    activeChatId: null,
    activeRequest: null,
    clarificationsAsked: 0,
    plan: { steps: [] },
    failure: null,
  };
}

const DOCTOR_PLACE = /doctor|medicine|clinic|checkup|physician/i;

/** Short topic label for the Chat history list. */
export function chatTitleForIntent(intent: ConversationIntent, destination?: string): string {
  switch (intent) {
    case "ride":
      return destination && DOCTOR_PLACE.test(destination) ? "Doctor ride" : "Ride";
    case "medication_reminder":
      return "Medication reminder";
    case "hospital_schedule":
      return "Hospital visit";
    case "appointment_info":
      return "Appointment";
    case "family_update":
      return "Family update";
    default:
      return "New chat";
  }
}

function chatSortTime(chat: ConversationChat): number {
  const stamp = chat.turns.at(-1)?.timestamp ?? chat.startedAt;
  const ms = Date.parse(stamp);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Current / active chat first, then older threads by last turn. */
export function chatsNewestFirst(chats: ConversationChat[], activeChatId?: string | null): ConversationChat[] {
  return [...chats].sort((a, b) => {
    if (activeChatId) {
      if (a.id === activeChatId) return -1;
      if (b.id === activeChatId) return 1;
    }
    return chatSortTime(b) - chatSortTime(a);
  });
}

export function activeChat(state: ConversationState): ConversationChat | undefined {
  return state.chats.find((chat) => chat.id === state.activeChatId);
}

export function syncActiveTurns(state: ConversationState): void {
  state.turns = activeChat(state)?.turns ?? [];
}

function allocateChatId(state: ConversationState, timestamp: string): string {
  const stamp = timestamp.replace(/[^\d]/g, "") || String(state.chats.length + 1);
  let id = `chat_${stamp}`;
  let n = 1;
  while (state.chats.some((chat) => chat.id === id)) {
    n += 1;
    id = `chat_${stamp}_${n}`;
  }
  return id;
}

function applyActiveChat(state: ConversationState, chat: ConversationChat): ConversationChat {
  state.activeChatId = chat.id;
  state.turns = chat.turns;
  return chat;
}

/** Always starts a fresh thread. Maria must ask for this — topics do not split alone. */
export function startNewChat(state: ConversationState, timestamp: string): ConversationChat {
  const chat: ConversationChat = {
    id: allocateChatId(state, timestamp),
    title: chatTitleForIntent("unknown"),
    intent: "unknown",
    startedAt: timestamp,
    turns: [],
  };
  state.chats.push(chat);
  state.activeRequest = null;
  state.clarificationsAsked = 0;
  state.plan = { steps: [] };
  state.failure = null;
  return applyActiveChat(state, chat);
}

export function ensureActiveChat(state: ConversationState, timestamp: string): ConversationChat {
  const existing = activeChat(state);
  if (existing) {
    state.turns = existing.turns;
    return existing;
  }
  return startNewChat(state, timestamp);
}

export function selectChat(state: ConversationState, chatId: string): ConversationChat | undefined {
  const chat = state.chats.find((item) => item.id === chatId);
  if (!chat) return undefined;
  return applyActiveChat(state, chat);
}

/** Every thread's turns, oldest first — caretaker activity reads this. */
export function allConversationTurns(state: ConversationState): ConversationTurn[] {
  return (state.chats ?? [])
    .flatMap((chat) => chat.turns)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}

export function applyChatTitleFromRequest(
  chat: ConversationChat,
  activeRequest: ActiveRequest | null,
): void {
  if (!activeRequest) return;
  chat.intent = activeRequest.intent;
  chat.title = chatTitleForIntent(activeRequest.intent, activeRequest.destination);
}

/** `POST /conversation/turn` body. */
export const conversationTurnRequestSchema = z.object({
  transcript: z.string().trim().min(1),
  sessionId: z.string().min(1).optional(),
  actor: z.enum(["senior", "caretaker"]).default("senior"),
  /** When set, this thread becomes active before the turn is recorded. */
  chatId: z.string().min(1).optional(),
});
export type ConversationTurnRequest = z.infer<typeof conversationTurnRequestSchema>;

/** `POST /conversation/chats` body. Omit `chatId` to start a new thread. */
export const conversationChatRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  chatId: z.string().min(1).optional(),
});
export type ConversationChatRequest = z.infer<typeof conversationChatRequestSchema>;

export const conversationChatResponseSchema = z.object({
  sessionId: z.string(),
  chatId: z.string(),
  conversation: conversationStateSchema,
});
export type ConversationChatResponse = z.infer<typeof conversationChatResponseSchema>;

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
