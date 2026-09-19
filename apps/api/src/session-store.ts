import {
  bookRideInputSchema,
  bookRideResultSchema,
  getAppointmentResultSchema,
  getMariaSeedBundle,
  notifyCaretakerInputSchema,
  sessionViewSchema,
  type Actor,
  type Appointment,
  type AuditEvent,
  type CaretakerActivityItem,
  type CareSignal,
  type PendingApproval,
  type PolicyDecision,
  type SessionBooking,
  type SessionRequest,
  type SessionView,
  type ToolName,
} from "@kasama/shared";
import { auditLog } from "./audit-log";

type SessionState = {
  sessionId: string;
  currentRequest: SessionRequest | null;
  pendingApproval: PendingApproval | null;
  appointment: Appointment | null;
  lastBooking: SessionBooking | null;
  caretakerActivity: CaretakerActivityItem[];
  careSignal: CareSignal | null;
  consentGranted: boolean;
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
    appointment: null,
    lastBooking: null,
    caretakerActivity: [],
    careSignal: seedCareSignal(),
    consentGranted: false,
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
  applyToolEvent: (input: ApplyToolEventInput) => SessionView;
  clear: () => void;
};

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, SessionState>();

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
          };
        }
        if (tool === "notify_caretaker") {
          appendCaretakerActivity(state, input, event, false);
        }
        return toView(state);
      }

      if (state.pendingApproval?.tool === tool) {
        state.pendingApproval = null;
      }

      if (tool === "get_appointment" && result) {
        const appointment = getAppointmentResultSchema.safeParse(result).data?.appointment;
        if (appointment) {
          state.appointment = appointment;
        }
      }

      if (tool === "book_ride" && result) {
        const booked = bookRideResultSchema.parse(result);
        const { optionId } = bookRideInputSchema.parse(input);
        state.lastBooking = {
          provider: "uber",
          optionId,
          status: booked.booking?.status ?? "not_implemented",
          confirmationId: booked.confirmationId,
          summary: booked.summary,
          timestamp: event.timestamp,
          consentGranted: consentGranted ?? true,
        };
        state.consentGranted = true;
      }

      if (tool === "notify_caretaker") {
        appendCaretakerActivity(state, input, event, true);
      }

      return toView(state);
    },
    clear() {
      sessions.clear();
    },
  };
}

export const sessionStore = createSessionStore();
