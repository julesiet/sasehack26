import { z } from "zod";

/** First live toolkit: caretaker Gmail (later `notify_caretaker`). Documented slug. */
export const COMPOSIO_DEFAULT_TOOLKIT = "gmail";

/** First safe read. Documented at https://docs.composio.dev/toolkits/gmail.md */
export const COMPOSIO_DEFAULT_TOOL = "GMAIL_GET_PROFILE";

/**
 * Documented create-draft slug at https://docs.composio.dev/toolkits/gmail.md
 * (`Create email draft`). Prefer this over `GMAIL_SEND_EMAIL` / `GMAIL_SEND_DRAFT`.
 */
export const COMPOSIO_GMAIL_CREATE_DRAFT_TOOL = "GMAIL_CREATE_EMAIL_DRAFT";

/** Tools this route may execute. Send slugs are rejected at the request boundary. */
export const composioToolSlugSchema = z.enum([
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
]);
export type ComposioToolSlug = z.infer<typeof composioToolSlugSchema>;

/** Demo inbox for James. Draft only — `POST /composio/execute` never sends. */
export const COMPOSIO_CARETAKER_DRAFT_RECIPIENT = "james.alvarez@example.com";

/** Documented `GMAIL_CREATE_EMAIL_DRAFT` fields for a caretaker note. */
export const GMAIL_CARETAKER_DRAFT_ARGUMENTS = {
  user_id: "me",
  recipient_email: COMPOSIO_CARETAKER_DRAFT_RECIPIENT,
  subject: "Note from Kasama about Maria",
  body: "Kasama drafted this note for James. It has not been sent.",
} as const;

/** Merge caller overrides onto the documented Gmail arguments for this slug. */
export function resolveComposioExecuteArguments(
  toolSlug: string,
  arguments_?: Record<string, unknown>,
): Record<string, unknown> {
  if (toolSlug === COMPOSIO_GMAIL_CREATE_DRAFT_TOOL) {
    const userId =
      typeof arguments_?.user_id === "string" && arguments_.user_id.length > 0
        ? arguments_.user_id
        : "me";
    return {
      ...GMAIL_CARETAKER_DRAFT_ARGUMENTS,
      ...arguments_,
      user_id: userId,
    };
  }
  return arguments_ ?? { user_id: "me" };
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
