import { z } from "zod";

/** First live toolkit: caretaker Gmail (later `notify_caretaker`). Documented slug. */
export const COMPOSIO_DEFAULT_TOOLKIT = "gmail";

/** First safe read. Documented at https://docs.composio.dev/toolkits/gmail.md */
export const COMPOSIO_DEFAULT_TOOL = "GMAIL_GET_PROFILE";

/**
 * Documented create-draft slug at https://docs.composio.dev/toolkits/gmail.md
 * (`Create email draft`).
 */
export const COMPOSIO_GMAIL_CREATE_DRAFT_TOOL = "GMAIL_CREATE_EMAIL_DRAFT";

/**
 * Documented send slug at https://docs.composio.dev/toolkits/gmail.md
 * (`Send email`). Only when the caller asks — default remains the profile read.
 */
export const COMPOSIO_GMAIL_SEND_TOOL = "GMAIL_SEND_EMAIL";

/** Tools this route may execute. `GMAIL_SEND_DRAFT` stays rejected. */
export const composioToolSlugSchema = z.enum([
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
  COMPOSIO_GMAIL_SEND_TOOL,
]);
export type ComposioToolSlug = z.infer<typeof composioToolSlugSchema>;

/** Caretaker inbox for Maria's Gmail session. */
export const COMPOSIO_CARETAKER_RECIPIENT = "juleselvandrade@gmail.com";

function caretakerUserId(arguments_?: Record<string, unknown>): string {
  return typeof arguments_?.user_id === "string" && arguments_.user_id.length > 0
    ? arguments_.user_id
    : "me";
}

/** Documented `GMAIL_CREATE_EMAIL_DRAFT` fields for a caretaker note. */
export const GMAIL_CARETAKER_DRAFT_ARGUMENTS = {
  user_id: "me",
  recipient_email: COMPOSIO_CARETAKER_RECIPIENT,
  subject: "Note from Kasama about Maria",
  body: "Kasama drafted this note for Jules. It has not been sent.",
} as const;

/** Documented `GMAIL_SEND_EMAIL` fields for a caretaker note. */
export const GMAIL_CARETAKER_SEND_ARGUMENTS = {
  user_id: "me",
  recipient_email: COMPOSIO_CARETAKER_RECIPIENT,
  subject: "Note from Kasama about Maria",
  body: "Kasama sent this note to Jules.",
} as const;

/** Merge caller overrides onto the documented Gmail arguments for this slug. */
export function resolveComposioExecuteArguments(
  toolSlug: string,
  arguments_?: Record<string, unknown>,
): Record<string, unknown> {
  if (toolSlug === COMPOSIO_GMAIL_CREATE_DRAFT_TOOL) {
    return {
      ...GMAIL_CARETAKER_DRAFT_ARGUMENTS,
      ...arguments_,
      user_id: caretakerUserId(arguments_),
    };
  }
  if (toolSlug === COMPOSIO_GMAIL_SEND_TOOL) {
    return {
      ...GMAIL_CARETAKER_SEND_ARGUMENTS,
      ...arguments_,
      user_id: caretakerUserId(arguments_),
    };
  }
  return arguments_ ?? { user_id: "me" };
}

/**
 * Gmail's documented create-draft result includes `draft_id`. Live Composio
 * often returns that value as `id` only — copy it so callers can keep the id.
 */
export function normalizeComposioExecuteData(toolSlug: string, data: unknown): unknown {
  if (toolSlug !== COMPOSIO_GMAIL_CREATE_DRAFT_TOOL) {
    return data;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const record = data as Record<string, unknown>;
  const draftId =
    (typeof record.draft_id === "string" && record.draft_id) ||
    (typeof record.id === "string" && record.id) ||
    undefined;
  if (!draftId) {
    return data;
  }
  return { ...record, draft_id: draftId };
}

/** `POST /composio/connect` body. */
export const composioConnectRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  toolkit: z.string().min(1).optional(),
  wait: z.boolean().optional(),
});
export type ComposioConnectRequest = z.infer<typeof composioConnectRequestSchema>;

/** `POST /composio/connect` response. */
export const composioConnectResponseSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  toolkit: z.string(),
  connected: z.boolean(),
  redirectUrl: z.string().url().optional(),
});
export type ComposioConnectResponse = z.infer<typeof composioConnectResponseSchema>;

/** `POST /composio/execute` body. */
export const composioExecuteRequestSchema = z.object({
  userId: z.string().min(1).optional(),
  toolSlug: composioToolSlugSchema.optional(),
  arguments: z.record(z.unknown()).optional(),
});
export type ComposioExecuteRequest = z.infer<typeof composioExecuteRequestSchema>;

/** `POST /composio/execute` response. `logId` is the Composio tool log. */
export const composioExecuteResponseSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  toolSlug: z.string(),
  successful: z.boolean(),
  data: z.unknown().optional(),
  logId: z.string().optional(),
  error: z.string().optional(),
  needsAuth: z.boolean().optional(),
  toolkit: z.string().optional(),
  redirectUrl: z.string().url().optional(),
});
export type ComposioExecuteResponse = z.infer<typeof composioExecuteResponseSchema>;
