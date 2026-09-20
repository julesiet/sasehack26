import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { MARIA_FAMILY_CONTACTS, type FamilyContact } from "./seed";
import { notifyCaretakerInputSchema } from "./tools";
import type { LastApproval, PendingApproval } from "./approval";

export const FAMILY_EMAIL_RECIPIENT = COMPOSIO_CARETAKER_RECIPIENT;
export const DEFAULT_FAMILY_CONTACT_ID = "contact_james";

const ALIASES: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /\bjules\b/i, id: "contact_jules" },
  { pattern: /\b(james(\s+alvarez)?|son|caretaker)\b/i, id: "contact_james" },
  { pattern: /\b(sarah|daughter)\b/i, id: "contact_sarah" },
  { pattern: /\bemily\b/i, id: "contact_emily" },
];

export function resolveFamilyRecipient(spoken = ""): FamilyContact {
  const text = spoken.trim();
  const match = ALIASES.find((alias) => alias.pattern.test(text));
  const id = match?.id ?? DEFAULT_FAMILY_CONTACT_ID;
  return MARIA_FAMILY_CONTACTS.find((contact) => contact.id === id) ?? MARIA_FAMILY_CONTACTS[1]!;
}

export function withNotifyRecipient(draft: {
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientId?: string;
  recipientName?: string;
}): {
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
} {
  const recipient = draft.recipientId
    ? MARIA_FAMILY_CONTACTS.find((contact) => contact.id === draft.recipientId)
    : resolveFamilyRecipient(draft.recipientName ?? "");
  const resolved = recipient ?? resolveFamilyRecipient("");
  return {
    summary: draft.summary,
    urgency: draft.urgency,
    recipientId: resolved.id,
    recipientName: resolved.name,
    recipientEmail: FAMILY_EMAIL_RECIPIENT,
  };
}

export function titleCaseUrgency(urgency: "low" | "normal" | "high"): string {
  return urgency === "low" ? "Low" : urgency === "high" ? "High" : "Normal";
}

export function familyMessageCardCopy(input: {
  recipientName: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  status: "pending" | "sent" | "cancelled";
}): {
  eyebrow: string;
  recipientName: string;
  intro: string;
  summary: string;
  urgencyLabel: string;
} {
  return {
    eyebrow: "MESSAGE TO",
    recipientName: input.recipientName,
    intro:
      input.status === "pending"
        ? "Preview only.\nNothing is sent yet."
        : input.status === "sent"
          ? "Sent."
          : "Not sent.",
    summary: input.summary,
    urgencyLabel: titleCaseUrgency(input.urgency),
  };
}

export function familyMessageFromApproval(
  pending: PendingApproval | null,
  lastApproval: LastApproval | null,
): {
  recipientName: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  status: "pending" | "sent" | "cancelled";
} | null {
  const tool = pending?.tool ?? lastApproval?.tool;
  if (tool !== "notify_caretaker") return null;
  const parsed = notifyCaretakerInputSchema.safeParse(pending?.input);
  const draft = parsed.success ? withNotifyRecipient(parsed.data) : null;
  return {
    recipientName: draft?.recipientName ?? lastApproval?.recipientName ?? resolveFamilyRecipient("").name,
    summary:
      draft?.summary ??
      pending?.preview ??
      lastApproval?.preview ??
      lastApproval?.summary ??
      "A note for your family.",
    urgency: draft?.urgency ?? lastApproval?.urgency ?? "normal",
    status: pending
      ? "pending"
      : lastApproval?.decision === "approved"
        ? "sent"
        : "cancelled",
  };
}

