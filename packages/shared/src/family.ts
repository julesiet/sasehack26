import { z } from "zod";
import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { containsHealthData } from "./policy";
import { notifyCaretakerInputSchema, type CaretakerUrgency } from "./tools";

export const FAMILY_EMAIL_RECIPIENT = COMPOSIO_CARETAKER_RECIPIENT;
export const DEFAULT_FAMILY_CONTACT_ID = "contact_james";

export const familyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  initial: z.string().min(1),
  relationship: z.string().min(1),
});
export type FamilyContact = z.infer<typeof familyContactSchema>;

/** Family row on the caretaker dashboard. James is also the policy caretaker. */
export const MARIA_FAMILY_CONTACTS: FamilyContact[] = [
  familyContactSchema.parse({
    id: "contact_sarah",
    name: "Sarah",
    initial: "S",
    relationship: "daughter",
  }),
  familyContactSchema.parse({
    id: "contact_james",
    name: "James Alvarez",
    initial: "J",
    relationship: "son",
  }),
  familyContactSchema.parse({
    id: "contact_emily",
    name: "Emily",
    initial: "E",
    relationship: "family",
  }),
  familyContactSchema.parse({
    id: "contact_jules",
    name: "Jules",
    initial: "U",
    relationship: "family",
  }),
];

export type FamilyMessageStatus = "pending" | "sent" | "cancelled";

export type FamilyMessageAnalysis = {
  eyebrow: string;
  recipientName: string;
  relationship: string;
  relationshipLabel: string;
  summary: string;
  urgency: CaretakerUrgency;
  urgencyLabel: string;
  healthShared: boolean;
  healthLabel: string;
  healthDetail: string;
  intro: string;
  spokenPrompt: string;
};

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
  urgency: CaretakerUrgency;
  recipientId?: string;
  recipientName?: string;
}): {
  summary: string;
  urgency: CaretakerUrgency;
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

export function titleCaseUrgency(urgency: CaretakerUrgency): string {
  return urgency === "low" ? "Low" : urgency === "high" ? "High" : "Normal";
}

export function titleCaseRelationship(relationship: string): string {
  const trimmed = relationship.trim();
  if (!trimmed) return "Family";
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
}

export function familyMessageAnalysis(input: {
  recipientName?: string;
  recipientId?: string;
  summary: string;
  urgency: CaretakerUrgency;
  status: FamilyMessageStatus;
}): FamilyMessageAnalysis {
  const resolved = withNotifyRecipient({
    summary: input.summary,
    urgency: input.urgency,
    recipientId: input.recipientId,
    recipientName: input.recipientName,
  });
  const contact =
    MARIA_FAMILY_CONTACTS.find((item) => item.id === resolved.recipientId) ??
    resolveFamilyRecipient(resolved.recipientName);
  const relationship = contact.relationship;
  const relationshipLabel = titleCaseRelationship(relationship);
  const healthShared = containsHealthData(resolved.summary);
  const intro =
    input.status === "pending"
      ? "Preview only.\nNothing is sent yet."
      : input.status === "sent"
        ? "Sent."
        : "Not sent.";
  const healthDetail = healthShared
    ? "Health information is included."
    : "This is not health information.";
  const spokenPrompt = [
    "Preview only. Nothing is sent yet.",
    `This note is for ${resolved.recipientName}, ${relationship}.`,
    `The message is: ${resolved.summary}`,
    `Urgency is ${titleCaseUrgency(resolved.urgency)}.`,
    healthShared
      ? "Health information is included."
      : "This note does not include health information.",
    "Should I send it?",
  ].join(" ");

  return {
    eyebrow: "MESSAGE TO",
    recipientName: resolved.recipientName,
    relationship,
    relationshipLabel,
    summary: resolved.summary,
    urgency: resolved.urgency,
    urgencyLabel: titleCaseUrgency(resolved.urgency),
    healthShared,
    healthLabel: healthShared ? "Yes" : "No",
    healthDetail,
    intro,
    spokenPrompt,
  };
}

export function familyMessageCardCopy(input: {
  recipientName: string;
  summary: string;
  urgency: CaretakerUrgency;
  status: FamilyMessageStatus;
  recipientId?: string;
}): FamilyMessageAnalysis {
  return familyMessageAnalysis(input);
}

type NotifyApprovalFields = {
  tool?: string;
  input?: unknown;
  preview?: string | null;
  recipientName?: string;
  urgency?: CaretakerUrgency;
  decision?: "approved" | "declined";
};

export function familyMessageFromApproval(
  pending: NotifyApprovalFields | null,
  lastApproval: NotifyApprovalFields | null,
): FamilyMessageAnalysis & { status: FamilyMessageStatus } | null {
  const tool = pending?.tool ?? lastApproval?.tool;
  if (tool !== "notify_caretaker") return null;
  const parsed = notifyCaretakerInputSchema.safeParse(pending?.input);
  const draft = parsed.success ? withNotifyRecipient(parsed.data) : null;
  const status: FamilyMessageStatus = pending
    ? "pending"
    : lastApproval?.decision === "approved"
      ? "sent"
      : "cancelled";
  const analysis = familyMessageAnalysis({
    recipientName: draft?.recipientName ?? lastApproval?.recipientName,
    recipientId: draft?.recipientId,
    summary:
      draft?.summary ??
      pending?.preview ??
      lastApproval?.preview ??
      "A note for your family.",
    urgency: draft?.urgency ?? lastApproval?.urgency ?? "normal",
    status,
  });
  return { ...analysis, status };
}
