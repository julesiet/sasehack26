import { z } from "zod";

/** First live toolkit: caretaker Gmail (later `notify_caretaker`). Documented slug. */
export const COMPOSIO_DEFAULT_TOOLKIT = "gmail";

/** First safe read. Documented at https://docs.composio.dev/toolkits/gmail.md */
export const COMPOSIO_DEFAULT_TOOL = "GMAIL_GET_PROFILE";

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
  toolSlug: z.string().min(1).optional(),
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
