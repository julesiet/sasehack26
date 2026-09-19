import { z } from "zod";
import { actors } from "./policy";
import { formatHospitalTimeLabel } from "./time-label";
import {
  saveHospitalVisitInputSchema,
  saveMedicationReminderInputSchema,
  type HospitalVisitDetails,
  type SaveMedicationReminderInput,
  type UberProduct,
  type UberRideOption,
} from "./tools";

/**
 * Approval checkpoints (#6). High-risk actions wait here until a human
 * says or taps yes. The model cannot approve.
 */

export const approvalActionSchema = z.enum([
  "book_ride",
  "notify_caretaker",
  "spend_money",
  "save_medication_reminder",
  "save_hospital_visit",
]);
export type ApprovalAction = z.infer<typeof approvalActionSchema>;

export const approvalDecisionKindSchema = z.enum(["approved", "declined"]);
export type ApprovalDecisionKind = z.infer<typeof approvalDecisionKindSchema>;

/** What Maria sees and hears while a high-risk action is waiting. */
export const pendingApprovalSchema = z.object({
  tool: z.string(),
  input: z.unknown(),
  reason: z.string(),
  summary: z.string(),
  timestamp: z.string(),
  action: approvalActionSchema.optional(),
  /** Spoken + on-screen question, e.g. "The Uber is $24.50. Should I book it?" */
  prompt: z.string().optional(),
  /** Large supporting line (price, recipient, or "Preview only"). */
  detail: z.string().optional(),
  estimate: z.string().optional(),
  /** Draft caretaker text. Showing this is not the same as sending. */
  preview: z.string().optional(),
  status: z.enum(["pending", "approved", "declined"]).default("pending"),
});
export type PendingApproval = z.infer<typeof pendingApprovalSchema>;

/** Last human yes/no for the caretaker view. */
export const lastApprovalSchema = z.object({
  tool: z.string(),
  action: approvalActionSchema.optional(),
  decision: approvalDecisionKindSchema,
  actor: z.enum(actors),
  timestamp: z.string(),
  summary: z.string(),
  prompt: z.string().optional(),
});
export type LastApproval = z.infer<typeof lastApprovalSchema>;

/** `POST /approvals` — tap Yes / No on the senior screen. */
export const approvalChoiceSchema = z.enum(["approve", "decline"]);
export type ApprovalChoice = z.infer<typeof approvalChoiceSchema>;

export const approvalRequestSchema = z.object({
  sessionId: z.string().min(1).optional(),
  decision: approvalChoiceSchema,
  actor: z.enum(["senior", "caretaker"]).default("senior"),
});
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;

export const approvalResponseSchema = z.object({
  sessionId: z.string(),
  decision: approvalDecisionKindSchema,
  reply: z.string(),
  pendingApproval: pendingApprovalSchema.nullable(),
  lastApproval: lastApprovalSchema.nullable(),
});
export type ApprovalResponse = z.infer<typeof approvalResponseSchema>;

/** Accessible demo Uber Maria confirms. Ride cards (#8) use the same id. */
export const DEMO_UBER_WAV_OPTION_ID = "uber_wav_1";
export const DEMO_UBER_WAV_ESTIMATE = "$24.50";

export function pendingMedicationReminder(
  pending: { tool?: string; input?: unknown } | null,
): SaveMedicationReminderInput | undefined {
  if (pending?.tool !== "save_medication_reminder") return undefined;
  const parsed = saveMedicationReminderInputSchema.safeParse(pending.input);
  return parsed.success ? parsed.data : undefined;
}

export function pendingHospitalVisit(
  pending: { tool?: string; input?: unknown } | null,
): HospitalVisitDetails | undefined {
  if (pending?.tool !== "save_hospital_visit") return undefined;
  const parsed = saveHospitalVisitInputSchema.safeParse(pending.input);
  return parsed.success ? parsed.data : undefined;
}

export function pendingRideOptionId(
  pending: { tool?: string; input?: unknown } | null,
): string | undefined {
  if (pending?.tool !== "book_ride" || !pending.input || typeof pending.input !== "object") {
    return undefined;
  }
  if (!("optionId" in pending.input)) return undefined;
  return String((pending.input as { optionId: unknown }).optionId);
}

export function rideProductTitle(product: UberProduct): string {
  return product === "WAV" ? "Wheelchair Uber" : "UberX";
}

/** Transcript that selects this product on the next conversation turn. */
export function spokenRideChoice(product: UberProduct): string {
  return product === "WAV" ? "the wheelchair Uber" : "the UberX";
}

export function selectedRideOption(
  options: UberRideOption[],
  pending: { tool?: string; input?: unknown } | null,
  product?: UberProduct,
): UberRideOption | undefined {
  const optionId = pendingRideOptionId(pending);
  if (optionId) {
    const fromPending = options.find((option) => option.optionId === optionId);
    if (fromPending) return fromPending;
  }
  if (product) {
    return options.find((option) => option.product === product);
  }
  return undefined;
}

export function bookingApprovalPrompt(estimate: string = DEMO_UBER_WAV_ESTIMATE): string {
  return `The Uber is ${estimate}. Should I book it?`;
}

export function notifyApprovalPrompt(): string {
  return "I can send this to your family. Should I send it?";
}

export function declinedBookingReply(): string {
  return "Okay. I will not book that Uber. Is there anything else you need?";
}

export function declinedNotifyReply(): string {
  return "Okay. I will not send that message. Is there anything else you need?";
}

export function medicationReminderPrompt(name: string, frequency: string): string {
  return `Add ${name}, ${frequency}, to your tasks?`;
}

export function hospitalVisitPrompt(placeName: string): string {
  return `I found ${placeName}. Should I save this appointment?`;
}

export function approvedMedicationReminderReply(input: { name: string; savedLocally?: boolean }): string {
  return input.savedLocally
    ? `I saved the ${input.name} reminder on this phone. It is on your Tasks list. Kasama did not change any medication.`
    : `I saved the ${input.name} reminder. It is on your Tasks list. Kasama did not change any medication.`;
}

export function healthSyncFailedReply(): string {
  return "We couldn't connect to your health provider. You can retry or save locally.";
}

export function declinedMedicationReminderReply(): string {
  return "Okay. I will not add that reminder. Kasama did not change any medication.";
}

export function approvedHospitalVisitReply(placeName: string): string {
  return `I saved the appointment details for ${placeName}.`;
}

export function declinedHospitalVisitReply(): string {
  return "Okay. I will not save that appointment. Is there anything else you need?";
}

export function approvedBookingReply(input: {
  estimate?: string;
  product?: "UberX" | "WAV";
  confirmationId: string;
}): string {
  const estimate = input.estimate ?? DEMO_UBER_WAV_ESTIMATE;
  const spoken = input.product === "UberX" ? "UberX" : "wheelchair Uber";
  return `I booked the ${spoken} for ${estimate}. Your confirmation is ${input.confirmationId}.`;
}

export function failedBookingReply(): string {
  return "I couldn't confirm that Uber booking. Nothing was charged. We can try again.";
}

export function approvedNotifyReply(): string {
  return "Okay. I sent that to your family.";
}

export function describePendingApproval(input: {
  tool: string;
  toolInput: unknown;
  rideOptions?: Array<{ optionId: string; product?: string; estimate?: string; accessible?: boolean }>;
}): Pick<PendingApproval, "action" | "prompt" | "detail" | "estimate" | "preview"> {
  if (input.tool === "book_ride") {
    const optionId =
      input.toolInput && typeof input.toolInput === "object" && "optionId" in input.toolInput
        ? String((input.toolInput as { optionId: unknown }).optionId)
        : DEMO_UBER_WAV_OPTION_ID;
    const option = input.rideOptions?.find((item) => item.optionId === optionId);
    const estimate = option?.estimate ?? DEMO_UBER_WAV_ESTIMATE;
    const product = option?.product ?? "WAV";
    return {
      action: "book_ride",
      prompt: bookingApprovalPrompt(estimate),
      detail: `${product} · ${estimate}`,
      estimate,
    };
  }
  if (input.tool === "notify_caretaker") {
    const preview =
      input.toolInput && typeof input.toolInput === "object" && "summary" in input.toolInput
        ? String((input.toolInput as { summary: unknown }).summary)
        : undefined;
    return {
      action: "notify_caretaker",
      prompt: notifyApprovalPrompt(),
      detail: "Preview only — not sent yet.",
      preview,
    };
  }
  if (input.tool === "save_medication_reminder") {
    const reminder =
      input.toolInput && typeof input.toolInput === "object"
        ? (input.toolInput as { name?: unknown; frequency?: unknown; saveLocally?: unknown })
        : {};
    const name = typeof reminder.name === "string" ? reminder.name : "this medication";
    const frequency = typeof reminder.frequency === "string" ? reminder.frequency : "as discussed";
    const saveLocally = reminder.saveLocally === true;
    return {
      action: "save_medication_reminder",
      prompt: saveLocally ? healthSyncFailedReply() : medicationReminderPrompt(name, frequency),
      detail: `${name} · ${frequency}`,
    };
  }
  if (input.tool === "save_hospital_visit") {
    const visit =
      input.toolInput && typeof input.toolInput === "object"
        ? (input.toolInput as { placeName?: unknown; reason?: unknown; timeLabel?: unknown })
        : {};
    const placeName = typeof visit.placeName === "string" ? visit.placeName : "the hospital";
    const reason = typeof visit.reason === "string" ? visit.reason : "";
    const timeLabel =
      typeof visit.timeLabel === "string" ? formatHospitalTimeLabel(visit.timeLabel) : "";
    return {
      action: "save_hospital_visit",
      prompt: hospitalVisitPrompt(placeName),
      detail: [reason, timeLabel].filter(Boolean).join(" · "),
    };
  }
  return {};
}
