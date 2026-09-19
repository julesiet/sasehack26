import { z } from "zod";
import { lastApprovalSchema, pendingApprovalSchema } from "./approval";
import { auditEventSchema } from "./audit";
import {
  activeRequestSchema,
  conversationFailureSchema,
  conversationPlanSchema,
  conversationReplyKindSchema,
} from "./conversation";
import { sessionBookingSchema } from "./session";
import { appointmentSchema, uberRideOptionSchema } from "./tools";

/**
 * Text / HTTP agent playground (#13).
 *
 * Developers send a spoken-style utterance and get the plan, tool calls,
 * Maria seed context, ride options, and any approval checkpoint — without
 * iOS UI and without auto-approving book / send / spend.
 */

/** Isolated from the iOS `default` session so curling the playground is safe. */
export const PLAYGROUND_DEFAULT_SESSION_ID = "playground";

/** The demo line from issue #13. */
export const PLAYGROUND_DEMO_TRANSCRIPT = "Please get me a ride to my doctor tomorrow.";

/**
 * Extra conversational "yes" turns the playground may run to open a
 * high-risk checkpoint. It never approves that checkpoint.
 */
export const MAX_PLAYGROUND_ADVANCE_TURNS = 2;

/**
 * - `turn`: one conversation turn (same as `POST /conversation/turn`).
 * - `checkpoint`: continue through a conversational proposal until a
 *   pending book/send approval, a failure, or a finished answer.
 */
export const playgroundUntilSchema = z.enum(["turn", "checkpoint"]);
export type PlaygroundUntil = z.infer<typeof playgroundUntilSchema>;

/** `POST /playground` body. */
export const playgroundRequestSchema = z.object({
  transcript: z.string().trim().min(1),
  sessionId: z.string().min(1).optional(),
  actor: z.enum(["senior", "caretaker"]).default("senior"),
  until: playgroundUntilSchema.default("checkpoint"),
});
export type PlaygroundRequest = z.infer<typeof playgroundRequestSchema>;

export const playgroundSeedSchema = z.object({
  profileId: z.string(),
  name: z.string(),
});
export type PlaygroundSeed = z.infer<typeof playgroundSeedSchema>;

/** `POST /playground` response. */
export const playgroundResponseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  kind: conversationReplyKindSchema,
  activeRequest: activeRequestSchema.nullable(),
  clarificationsAsked: z.number().int().nonnegative(),
  plan: conversationPlanSchema.default({ steps: [] }),
  failure: conversationFailureSchema.nullable().default(null),
  pendingApproval: pendingApprovalSchema.nullable().default(null),
  appointment: appointmentSchema.nullable(),
  rideOptions: z.array(uberRideOptionSchema).default([]),
  lastBooking: sessionBookingSchema.nullable().default(null),
  lastApproval: lastApprovalSchema.nullable().default(null),
  events: z.array(auditEventSchema),
  seed: playgroundSeedSchema,
  until: playgroundUntilSchema,
  /** True when the playground accepted a ride plan so the $24.50 checkpoint could open. */
  acceptedPlan: z.boolean().default(false),
});
export type PlaygroundResponse = z.infer<typeof playgroundResponseSchema>;
