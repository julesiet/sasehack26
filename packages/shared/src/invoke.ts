import { z } from "zod";
import { actors } from "./policy";

export const invokeToolRequestSchema = z.object({
  input: z.unknown(),
  actor: z.enum(actors).default("model"),
  approvalToken: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  consentGranted: z.boolean().optional(),
  recipient: z.string().optional(),
  allowedRecipients: z.array(z.string()).optional(),
});

export type InvokeToolRequest = z.infer<typeof invokeToolRequestSchema>;
