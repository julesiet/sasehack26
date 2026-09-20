import {
  approvalRequestSchema,
  approvalResponseSchema,
  approvedBookingReply,
  approvedHospitalVisitReply,
  approvedMedicationReminderReply,
  approvedNotifyReply,
  declinedBookingReply,
  declinedHospitalVisitReply,
  declinedMedicationReminderReply,
  declinedNotifyReply,
  failedBookingReply,
  healthSyncFailedReply,
  resolveSessionId,
  type ActiveRequest,
  type Actor,
  type ApprovalChoice,
  type ConversationFailure,
  type ConversationPlan,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { planFromAuditEvents } from "./harness";
import { invokeTool } from "./invoke-tool";
import { sessionStore } from "./session-store";

export type ApprovalHttpResult = {
  status: 200 | 400 | 409;
  body: Record<string, unknown>;
};

export type ResolvedApproval = {
  reply: string;
  activeRequest: ActiveRequest | null;
  plan: ConversationPlan;
  failure: ConversationFailure | null;
};

function humanToken(actor: Actor): string {
  return `approval_${actor}_${Date.now()}`;
}

export async function resolvePendingApproval(input: {
  sessionId: string;
  actor: "senior" | "caretaker";
  decision: ApprovalChoice;
}): Promise<ResolvedApproval> {
  const sessionId = resolveSessionId(input.sessionId);
  const pending = sessionStore.get(sessionId).pendingApproval;

  if (!pending) {
    return {
      reply: "There is nothing waiting for a yes or no right now.",
      activeRequest: sessionStore.getConversation(sessionId).activeRequest,
      plan: { steps: [] },
      failure: null,
    };
  }

  if (input.decision === "decline") {
    const before = auditLog.list().length;
    const view = sessionStore.declinePending({ sessionId, actor: input.actor });
    const reply =
      pending.tool === "notify_caretaker"
        ? declinedNotifyReply()
        : pending.tool === "save_medication_reminder"
          ? declinedMedicationReminderReply()
          : pending.tool === "save_hospital_visit"
            ? declinedHospitalVisitReply()
            : declinedBookingReply();
    return {
      reply,
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: null,
    };
  }

  const before = auditLog.list().length;
  const invoked = await invokeTool(pending.tool, {
    input: pending.input,
    actor: input.actor,
    approvalToken: humanToken(input.actor),
    sessionId,
    consentGranted: true,
  });
  const view = sessionStore.get(sessionId);
  if (pending.tool === "notify_caretaker") {
    return {
      reply: approvedNotifyReply(),
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: null,
    };
  }

  if (pending.tool === "save_medication_reminder") {
    const reminder =
      pending.input && typeof pending.input === "object" && "name" in pending.input
        ? String((pending.input as { name: unknown }).name)
        : "this medication";
    if (view.pendingApproval?.tool === "save_medication_reminder") {
      return {
        reply: healthSyncFailedReply(),
        activeRequest: view.conversation.activeRequest,
        plan: planFromAuditEvents(auditLog.list().slice(before)),
        failure: {
          kind: "retry",
          tool: "save_medication_reminder",
          summary: healthSyncFailedReply(),
        },
      };
    }
    return {
      reply: approvedMedicationReminderReply({
        name: reminder,
        savedLocally: invoked.body.savedLocally === true,
      }),
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: invoked.body.success === false
        ? { kind: "retry", tool: "save_medication_reminder", summary: String(invoked.body.summary ?? "") }
        : null,
    };
  }

  if (pending.tool === "save_hospital_visit") {
    const placeName =
      pending.input && typeof pending.input === "object" && "placeName" in pending.input
        ? String((pending.input as { placeName: unknown }).placeName)
        : "the hospital";
    return {
      reply: approvedHospitalVisitReply(placeName),
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: null,
    };
  }

  const confirmationId =
    invoked.status === 200 &&
    invoked.body.success === true &&
    typeof invoked.body.confirmationId === "string"
      ? invoked.body.confirmationId
      : undefined;
  const option = view.lastRideOptions.find((item) => {
    const input = pending.input;
    return (
      input &&
      typeof input === "object" &&
      "optionId" in input &&
      item.optionId === String((input as { optionId: unknown }).optionId)
    );
  });
  if (!confirmationId) {
    return {
      reply: failedBookingReply(),
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: {
        kind: "retry",
        tool: "book_ride",
        summary: "Uber booking could not be confirmed.",
      },
    };
  }
  return {
    reply: approvedBookingReply({
      estimate: pending.estimate ?? option?.estimate,
      product: option?.product,
      confirmationId,
    }),
    activeRequest: view.conversation.activeRequest,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: null,
  };
}

export async function decideApproval(raw: unknown): Promise<ApprovalHttpResult> {
  const request = approvalRequestSchema.safeParse(raw);
  if (!request.success) {
    return {
      status: 400,
      body: { success: false, summary: "Invalid approval.", issues: request.error.issues },
    };
  }

  const sessionId = resolveSessionId(request.data.sessionId);
  if (!sessionStore.get(sessionId).pendingApproval) {
    return {
      status: 409,
      body: { success: false, summary: "There is nothing waiting for a yes or no." },
    };
  }

  const resolved = await resolvePendingApproval({
    sessionId,
    actor: request.data.actor,
    decision: request.data.decision,
  });

  const view = sessionStore.applyConversationTurn({
    sessionId,
    seniorText: request.data.decision === "approve" ? "Yes" : "No",
    kasamaText: resolved.reply,
    kind: "answer",
    activeRequest: resolved.activeRequest,
    askedClarification: false,
    plan: resolved.plan,
    failure: resolved.failure,
    timestamp: new Date().toISOString(),
  });

  const body = approvalResponseSchema.parse({
    sessionId,
    decision: request.data.decision === "approve" ? "approved" : "declined",
    reply: resolved.reply,
    pendingApproval: view.pendingApproval,
    lastApproval: view.lastApproval,
  });
  return { status: 200, body };
}
