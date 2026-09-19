import {
  bookRideInputSchema,
  bookRideResultSchema,
  describePendingApproval,
  emptyConversationState,
  findRideOptionsResultSchema,
  getAppointmentResultSchema,
  getMariaSeedBundle,
  notifyCaretakerInputSchema,
  sessionViewSchema,
  type Actor,
  type ActiveRequest,
  type Appointment,
  type AuditEvent,
  type CaretakerActivityItem,
  type CareSignal,
  type ConversationFailure,
  type ConversationPlan,
  type ConversationReplyKind,
  type ConversationState,
  type LastApproval,
  type PendingApproval,
  type PolicyDecision,
  type SessionBooking,
  type SessionRequest,
  type SessionView,
  type ToolName,
  type UberRideOption,
} from "@kasama/shared";
import { auditLog } from "./audit-log";

type SessionState = {
  sessionId: string;
  currentRequest: SessionRequest | null;
  pendingApproval: PendingApproval | null;
  lastApproval: LastApproval | null;
  lastRideOptions: UberRideOption[];
  appointment: Appointment | null;
  lastBooking: SessionBooking | null;
  caretakerActivity: CaretakerActivityItem[];
  careSignal: CareSignal | null;
  consentGranted: boolean;
  conversation: ConversationState;
};

export type ApplyConversationTurnInput = {
  sessionId: string;
  seniorText: string;
  kasamaText: string;
  kind: ConversationReplyKind;
  activeRequest: ActiveRequest | null;
  /** Set when this turn asked a clarification; the store enforces the count. */
  askedClarification: boolean;
  plan: ConversationPlan;
  failure: ConversationFailure | null;
  timestamp: string;
};

export type ApplyToolEventInput = {
  sessionId: string;
  tool: ToolName;
  input: unknown;
  actor: Actor;
  consentGranted?: boolean;
  decision: PolicyDecision;
  result?: Record<string, unknown>;
  event: AuditEvent;
};

function seedCareSignal(): CareSignal {
  const seed = getMariaSeedBundle();
  const flagged = seed.priorRequests.filter((request) => request.flaggedConfusion);
  const latestWearable = seed.wearableReadings.at(-1);
  const note =
    flagged[0]?.note ??
    "Recent activity is worth reviewing. This is not a diagnosis.";

  return {
    label: "worth reviewing",
    note,
    source: "maria_seed",
    flaggedConfusionCount: flagged.length,
    wearable: latestWearable,
  };
}

function emptyState(sessionId: string): SessionState {
  return {
    sessionId,
    currentRequest: null,
    pendingApproval: null,
    lastApproval: null,
    lastRideOptions: [],
    appointment: null,
    lastBooking: null,
    caretakerActivity: [],
    careSignal: seedCareSignal(),
    consentGranted: false,
    conversation: emptyConversationState(),
  };
}

function eventsFor(sessionId: string): AuditEvent[] {
  return auditLog.list().filter((event) => event.whoAsked.sessionId === sessionId);
}

function toView(state: SessionState): SessionView {
  return sessionViewSchema.parse({
    ...state,
    events: eventsFor(state.sessionId),
  });
}

function appendCaretakerActivity(
  state: SessionState,
  input: unknown,
  event: AuditEvent,
  sent: boolean,
): void {
  const draft = notifyCaretakerInputSchema.parse(input);
  state.caretakerActivity.push({
    id: event.id,
    timestamp: event.timestamp,
    summary: draft.summary,
    urgency: draft.urgency,
    sent,
    preview: !sent,
  });
}

export type SessionStore = {
  get: (sessionId: string) => SessionView;
  /** Conversation memory for the voice loop, without the audit projection. */
  getConversation: (sessionId: string) => ConversationState;
  applyToolEvent: (input: ApplyToolEventInput) => SessionView;
  applyConversationTurn: (input: ApplyConversationTurnInput) => SessionView;
  declinePending: (input: { sessionId: string; actor: Actor }) => SessionView;
  clear: () => void;
};

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, SessionState>();
  let turnCounter = 0;

  function nextTurnId(): string {
    turnCounter += 1;
    return `turn_${turnCounter}`;
  }

  function getOrCreate(sessionId: string): SessionState {
    const existing = sessions.get(sessionId);
    if (existing) {
      return existing;
    }
    const created = emptyState(sessionId);
    sessions.set(sessionId, created);
    return created;
  }

  return {
    get(sessionId) {
      return toView(getOrCreate(sessionId));
    },
    getConversation(sessionId) {
      return structuredClone(getOrCreate(sessionId).conversation);
    },
    applyConversationTurn({
      sessionId,
      seniorText,
      kasamaText,
      kind,
      activeRequest,
      askedClarification,
      plan,
      failure,
      timestamp,
    }) {
      const state = getOrCreate(sessionId);
      const conversation = state.conversation;

      conversation.turns.push({
        id: nextTurnId(),
        timestamp,
        speaker: "senior",
        text: seniorText,
      });
      conversation.turns.push({
        id: nextTurnId(),
        timestamp,
        speaker: "kasama",
        text: kasamaText,
        kind,
      });

      // The clarification budget is per request: it grows while Kasama is still
      // gathering and resets once the request resolves (proposal, answer, or dropped).
      if (askedClarification) {
        conversation.clarificationsAsked += 1;
      } else if (activeRequest === null || activeRequest.status !== "gathering") {
        conversation.clarificationsAsked = 0;
      }
      conversation.activeRequest = activeRequest;
      conversation.plan = plan;
      conversation.failure = failure;

      return toView(state);
    },
    applyToolEvent({
      sessionId,
      tool,
      input,
      actor,
      consentGranted,
      decision,
      result,
      event,
    }) {
      const state = getOrCreate(sessionId);
      state.currentRequest = {
        tool,
        input,
        actor,
        timestamp: event.timestamp,
      };

      if (consentGranted) {
        state.consentGranted = true;
      }

      if (tool === "find_ride_options" && result) {
        const rides = findRideOptionsResultSchema.safeParse(result);
        if (rides.success) {
          state.lastRideOptions = rides.data.options;
        }
      }

      if (!decision.allowed) {
        if (
          decision.reason === "confirmation_required" ||
          decision.reason === "model_cannot_self_approve"
        ) {
          state.pendingApproval = {
            tool,
            input,
            reason: decision.reason,
            summary: decision.summary,
            timestamp: event.timestamp,
            status: "pending",
            ...describePendingApproval({
              tool,
              toolInput: input,
              rideOptions: state.lastRideOptions,
            }),
          };
        }
        if (tool === "notify_caretaker") {
          appendCaretakerActivity(state, input, event, false);
        }
        return toView(state);
      }

      if (decision.preview && tool === "notify_caretaker") {
        state.pendingApproval = {
          tool,
          input,
          reason: "confirmation_required",
          summary: "This action requires a confirmation token from a human.",
          timestamp: event.timestamp,
          status: "pending",
          ...describePendingApproval({
            tool,
            toolInput: input,
            rideOptions: state.lastRideOptions,
          }),
        };
        appendCaretakerActivity(state, input, event, false);
        return toView(state);
      }

      if (state.pendingApproval?.tool === tool) {
        state.lastApproval = {
          tool,
          action: state.pendingApproval.action,
          decision: "approved",
          actor,
          timestamp: event.timestamp,
          summary: decision.summary,
          prompt: state.pendingApproval.prompt,
        };
        state.pendingApproval = null;
      } else if (tool === "book_ride" || tool === "notify_caretaker") {
        const described = describePendingApproval({
          tool,
          toolInput: input,
          rideOptions: state.lastRideOptions,
        });
        state.lastApproval = {
          tool,
          action: described.action,
          decision: "approved",
          actor,
          timestamp: event.timestamp,
          summary: decision.summary,
          prompt: described.prompt,
        };
      }

      if (tool === "get_appointment" && result) {
        const appointment = getAppointmentResultSchema.safeParse(result).data?.appointment;
        if (appointment) {
          state.appointment = appointment;
        }
      }

      if (tool === "book_ride" && result) {
        const booked = bookRideResultSchema.parse(result);
        if (booked.success && booked.booking?.status === "booked") {
          const { optionId } = bookRideInputSchema.parse(input);
          state.lastBooking = {
            provider: "uber",
            optionId,
            status: "booked",
            confirmationId: booked.confirmationId,
            summary: booked.summary,
            timestamp: event.timestamp,
            consentGranted: consentGranted ?? true,
          };
          state.consentGranted = true;
          state.conversation.activeRequest = null;
        }
      }

      if (tool === "notify_caretaker") {
        appendCaretakerActivity(state, input, event, true);
      }

      return toView(state);
    },
    declinePending({ sessionId, actor }) {
      const state = getOrCreate(sessionId);
      const pending = state.pendingApproval;
      if (!pending) {
        return toView(state);
      }

      const summary =
        pending.tool === "notify_caretaker"
          ? "The caretaker message was declined. Nothing was sent."
          : "The Uber booking was declined. Nothing was booked.";

      const event = auditLog.append({
        whoAsked: { actor, sessionId },
        proposed: { tool: pending.tool, input: pending.input },
        approved: { allowed: false, by: actor, approvalTokenPresent: false },
        executed: { tool: pending.tool, attempted: false },
        outcome: {
          success: false,
          denied: true,
          reason: "declined_by_human",
          summary,
        },
      });

      state.currentRequest = {
        tool: pending.tool,
        input: pending.input,
        actor,
        timestamp: event.timestamp,
      };
      state.lastApproval = {
        tool: pending.tool,
        action: pending.action,
        decision: "declined",
        actor,
        timestamp: event.timestamp,
        summary,
        prompt: pending.prompt,
      };
      state.pendingApproval = null;
      state.conversation.activeRequest = null;
      return toView(state);
    },
    clear() {
      sessions.clear();
      turnCounter = 0;
    },
  };
}

export const sessionStore = createSessionStore();
