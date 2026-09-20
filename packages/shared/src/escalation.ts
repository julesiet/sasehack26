import type { CaretakerPreferences, MariaSeedBundle } from "./seed";
import type { SessionView } from "./session";
import { caretakerUrgencySchema } from "./tools";
import { z } from "zod";

/**
 * Evaluates Maria's seeded caretaker escalation rules (#2) against the
 * current session. Every match produces a draft only — this never calls
 * `notify_caretaker`, never marks anything sent, and never diagnoses a
 * medical condition. Sending stays a separate, human-approved step (#16).
 */

export type CaretakerUrgency = z.infer<typeof caretakerUrgencySchema>;

export const escalationStatusSchema = z.enum(["drafted", "deferred"]);
export type EscalationStatus = z.infer<typeof escalationStatusSchema>;

export const escalationDraftSchema = z.object({
  summary: z.string(),
  urgency: caretakerUrgencySchema,
});
export type EscalationDraft = z.infer<typeof escalationDraftSchema>;

export const escalationDecisionSchema = z.object({
  ruleId: z.string(),
  urgency: caretakerUrgencySchema,
  status: escalationStatusSchema,
  /** Present only when `status` is `"drafted"` — pending approval, not sent. */
  draft: escalationDraftSchema.nullable(),
  reason: z.string(),
});
export type EscalationDecision = z.infer<typeof escalationDecisionSchema>;

const TEN_MINUTES_MS = 10 * 60 * 1000;

type RuleContext = {
  seed: MariaSeedBundle;
  view: SessionView | null;
  now: Date;
};

/** Returns a draft summary when the rule's condition is met, else `null`. */
type RuleCheck = (context: RuleContext) => string | null;

const RULE_CHECKS: Record<string, RuleCheck> = {
  escalation_ride_booked: ({ seed, view }) => {
    if (view?.lastBooking?.status !== "booked") return null;
    const name = firstName(seed.profile.name);
    const confirmation = view.lastBooking.confirmationId
      ? ` (confirmation ${view.lastBooking.confirmationId})`
      : "";
    return `${name}'s ride is booked${confirmation}.`;
  },

  escalation_repeated_confusion: ({ seed }) => {
    const flaggedPerDay = new Map<string, number>();
    for (const request of seed.priorRequests) {
      if (!request.flaggedConfusion) continue;
      const day = request.timestamp.slice(0, 10);
      flaggedPerDay.set(day, (flaggedPerDay.get(day) ?? 0) + 1);
    }
    const hasRepeatedDay = [...flaggedPerDay.values()].some((count) => count >= 2);
    if (!hasRepeatedDay) return null;
    const name = firstName(seed.profile.name);
    return `${name} asked about the same thing more than once today. Worth checking in.`;
  },

  escalation_missed_confirmation: ({ view, now }) => {
    if (view?.pendingApproval?.tool !== "book_ride") return null;
    const elapsedMs = now.getTime() - new Date(view.pendingApproval.timestamp).getTime();
    if (elapsedMs <= TEN_MINUTES_MS) return null;
    return "The ride pickup hasn't been confirmed in over 10 minutes. Worth checking in.";
  },
};

function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function parseHoursAndMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** `quietHours` may cross midnight (e.g. 21:00–07:00). */
function isWithinQuietHours(now: Date, quietHours: CaretakerPreferences["quietHours"]): boolean {
  const start = parseHoursAndMinutes(quietHours.start);
  const end = parseHoursAndMinutes(quietHours.end);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

/**
 * Pure evaluation of Maria's seeded escalation rules. Pass `now` explicitly
 * in tests to control quiet-hours and elapsed-time checks.
 */
export function evaluateEscalationRules(input: {
  seed: MariaSeedBundle;
  view: SessionView | null;
  now?: Date;
}): EscalationDecision[] {
  const now = input.now ?? new Date();
  const { seed, view } = input;
  const quietHours = seed.caretakerPreferences.quietHours;
  const withinQuietHours = isWithinQuietHours(now, quietHours);

  const decisions: EscalationDecision[] = [];
  for (const rule of seed.caretakerPreferences.escalationRules) {
    const check = RULE_CHECKS[rule.id];
    if (!check) continue;
    const summary = check({ seed, view, now });
    if (summary === null) continue;

    if (withinQuietHours) {
      decisions.push(
        escalationDecisionSchema.parse({
          ruleId: rule.id,
          urgency: rule.urgency,
          status: "deferred",
          draft: null,
          reason: `Deferred: within quiet hours (${quietHours.start}–${quietHours.end}).`,
        }),
      );
      continue;
    }

    decisions.push(
      escalationDecisionSchema.parse({
        ruleId: rule.id,
        urgency: rule.urgency,
        status: "drafted",
        draft: { summary, urgency: rule.urgency },
        reason: `Matched: ${rule.condition}`,
      }),
    );
  }

  return decisions;
}
