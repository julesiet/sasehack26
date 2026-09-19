import {
  approvalRequestSchema,
  approvalResponseSchema,
  approvedBookingReply,
  approvedNotifyReply,
  declinedBookingReply,
  declinedNotifyReply,
  failedBookingReply,
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

export function resolvePendingApproval(input: {
  sessionId: string;
  actor: "senior" | "caretaker";
  decision: ApprovalChoice;
}): ResolvedApproval {
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
    return {
      reply: pending.tool === "notify_caretaker" ? declinedNotifyReply() : declinedBookingReply(),
      activeRequest: view.conversation.activeRequest,
      plan: planFromAuditEvents(auditLog.list().slice(before)),
      failure: null,
    };
  }

  const before = auditLog.list().length;
  invokeTool(pending.tool, {
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

  const confirmationId = view.lastBooking?.confirmationId;
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

export function decideApproval(raw: unknown): ApprovalHttpResult {
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

  const resolved = resolvePendingApproval({
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
