import { z } from "zod";
import { actors } from "./policy";

export const auditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  whoAsked: z.object({
    actor: z.enum(actors),
    sessionId: z.string().optional(),
  }),
  proposed: z.object({
    tool: z.string(),
    input: z.unknown(),
  }),
  approved: z
    .object({
      allowed: z.boolean(),
      by: z.enum(actors).optional(),
      approvalTokenPresent: z.boolean(),
    })
    .nullable(),
  executed: z
    .object({
      tool: z.string(),
      attempted: z.boolean(),
    })
    .nullable(),
  outcome: z.object({
    success: z.boolean(),
    summary: z.string(),
    denied: z.boolean().optional(),
    reason: z.string().optional(),
  }),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export type AuditEventInput = Omit<AuditEvent, "id" | "timestamp">;

export type AuditLog = {
  append: (input: AuditEventInput) => AuditEvent;
  list: () => AuditEvent[];
  clear: () => void;
};

export function createAuditLog(): AuditLog {
  const events: AuditEvent[] = [];
  let seq = 0;

  return {
    append(input) {
      const event = auditEventSchema.parse({
        id: `evt_${++seq}`,
        timestamp: new Date().toISOString(),
        ...input,
      });
      events.push(event);
      return event;
    },
    list() {
      return events.slice();
    },
    clear() {
      events.length = 0;
      seq = 0;
    },
  };
}
