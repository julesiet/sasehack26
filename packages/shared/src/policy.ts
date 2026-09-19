import { toolNames, type ToolName } from "./tools";

export const actors = ["model", "senior", "caretaker", "doctor"] as const;
export type Actor = (typeof actors)[number];

export const policyActions = [
  "read_calendar",
  "search_rides",
  "draft_caretaker_message",
  "send_message",
  "book_ride",
  "spend_money",
  "change_medication",
  "share_health_information",
  "diagnose",
] as const;

export type PolicyAction = (typeof policyActions)[number];

export const policyRequirements = [
  "automatic",
  "automatic_preview",
  "require_confirmation",
  "caretaker_doctor_only",
  "explicit_consent",
  "never",
] as const;

export type PolicyRequirement = (typeof policyRequirements)[number];

export const POLICY_TABLE = {
  read_calendar: { requirement: "automatic" },
  search_rides: { requirement: "automatic" },
  draft_caretaker_message: { requirement: "automatic_preview" },
  send_message: { requirement: "require_confirmation" },
  book_ride: { requirement: "require_confirmation" },
  spend_money: { requirement: "require_confirmation" },
  change_medication: { requirement: "caretaker_doctor_only" },
  share_health_information: { requirement: "explicit_consent" },
  diagnose: { requirement: "never" },
} as const satisfies Record<PolicyAction, { requirement: PolicyRequirement }>;

export const HIGH_RISK_ACTIONS = [
  "send_message",
  "book_ride",
  "spend_money",
  "change_medication",
  "share_health_information",
  "diagnose",
] as const satisfies readonly PolicyAction[];

export const TOOL_ACTIONS = {
  get_appointment: ["read_calendar"],
  find_ride_options: ["search_rides"],
  book_ride: ["book_ride", "spend_money"],
  notify_caretaker: ["draft_caretaker_message", "send_message"],
} as const satisfies Record<ToolName, readonly PolicyAction[]>;

export type ApprovalContext = {
  actor: Actor;
  approvalToken?: string;
  consentGranted?: boolean;
  recipient?: string;
  allowedRecipients?: readonly string[];
};

export type PolicyDecision = {
  allowed: boolean;
  action: PolicyAction;
  requirement: PolicyRequirement;
  preview?: boolean;
  reason?: string;
  summary: string;
};

const MODEL_SELF_APPROVE_REASON = "model_cannot_self_approve";

function hasHumanApproval(ctx: ApprovalContext): boolean {
  return Boolean(ctx.approvalToken) && ctx.actor !== "model";
}

function deny(
  action: PolicyAction,
  requirement: PolicyRequirement,
  reason: string,
  summary: string,
): PolicyDecision {
  return { allowed: false, action, requirement, reason, summary };
}

function allow(
  action: PolicyAction,
  requirement: PolicyRequirement,
  extra?: { preview?: boolean },
): PolicyDecision {
  return {
    allowed: true,
    action,
    requirement,
    summary: `Allowed: ${action}`,
    ...extra,
  };
}

export function evaluateAction(
  action: PolicyAction,
  ctx: ApprovalContext,
): PolicyDecision {
  const requirement = POLICY_TABLE[action].requirement;

  if (requirement === "never") {
    return deny(
      action,
      requirement,
      "diagnose_not_allowed",
      "Kasama cannot diagnose. This action is never allowed.",
    );
  }

  if (requirement === "automatic") {
    return allow(action, requirement);
  }

  if (requirement === "automatic_preview") {
    return allow(action, requirement, { preview: true });
  }

  if (requirement === "require_confirmation") {
    if (ctx.actor === "model" && ctx.approvalToken) {
      return deny(
        action,
        requirement,
        MODEL_SELF_APPROVE_REASON,
        "The model cannot independently approve this action.",
      );
    }
    if (!hasHumanApproval(ctx)) {
      return deny(
        action,
        requirement,
        "confirmation_required",
        "This action requires a confirmation token from a human.",
      );
    }
    return allow(action, requirement);
  }

  if (requirement === "caretaker_doctor_only") {
    if (ctx.actor !== "caretaker" && ctx.actor !== "doctor") {
      return deny(
        action,
        requirement,
        "caretaker_doctor_only",
        "Only a caretaker or doctor can change medication or the medical plan.",
      );
    }
    if (!hasHumanApproval(ctx)) {
      return deny(
        action,
        requirement,
        "confirmation_required",
        "Medication or medical-plan changes require an approval token.",
      );
    }
    return allow(action, requirement);
  }

  if (ctx.actor === "model") {
    return deny(
      action,
      requirement,
      MODEL_SELF_APPROVE_REASON,
      "The model cannot grant consent to share health information.",
    );
  }
  if (!ctx.consentGranted) {
    return deny(
      action,
      requirement,
      "consent_required",
      "Sharing health information requires explicit consent.",
    );
  }
  if (!ctx.recipient || !ctx.allowedRecipients?.includes(ctx.recipient)) {
    return deny(
      action,
      requirement,
      "recipient_not_allowed",
      "Health information can only be shared with an allowed recipient.",
    );
  }
  return allow(action, requirement);
}

export function evaluateToolCall(
  tool: ToolName,
  ctx: ApprovalContext,
): PolicyDecision {
  if (tool === "notify_caretaker") {
    const send = evaluateAction("send_message", ctx);
    if (send.allowed) {
      return send;
    }
    // Missing human token → automatic draft. Self-approve still fails the send.
    if (send.reason === "confirmation_required") {
      return evaluateAction("draft_caretaker_message", ctx);
    }
    return send;
  }

  const actions = TOOL_ACTIONS[tool];
  let last: PolicyDecision | undefined;
  for (const action of actions) {
    const decision = evaluateAction(action, ctx);
    last = decision;
    if (!decision.allowed) {
      return decision;
    }
  }
  return last ?? allow("read_calendar", "automatic");
}

export function isKnownTool(name: string): name is ToolName {
  return (toolNames as readonly string[]).includes(name);
}
