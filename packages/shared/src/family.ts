import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { MARIA_FAMILY_CONTACTS, type FamilyContact } from "./seed";

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
