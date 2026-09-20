import {
  bookRideInputSchema,
  bookRideResultSchema,
  DEFAULT_SESSION_ID,
  applyChatTitleFromRequest,
  describePendingApproval,
  emptyConversationState,
  ensureActiveChat,
  findRideOptionsResultSchema,
  getAppointmentResultSchema,
  getMariaDemoSession,
  getMariaLiveDemoSession,
  getMariaSeedBundle,
  notifyCaretakerInputSchema,
  notifyCaretakerResultSchema,
  saveHospitalVisitInputSchema,
  saveHospitalVisitResultSchema,
  saveMedicationReminderInputSchema,
  saveMedicationReminderResultSchema,
  selectChat,
  sessionViewSchema,
  startNewChat,
  withNotifyRecipient,
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
  type SessionHospitalVisit,
  type SessionMedicationReminder,
  type SessionRequest,
  type SessionResetPreset,
  type SessionView,
  type SeniorTask,
  type ToolName,
  type UberRideOption,
  generateCaretakerNarrative,
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
  lastMedicationReminder: SessionMedicationReminder | null;
  lastHospitalVisit: SessionHospitalVisit | null;
  tasks: SeniorTask[];
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
  extraKasamaTexts?: string[];
  skipKasamaTurn?: boolean;
  chatId?: string;
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

function emptyState(
  sessionId: string,
  preset: SessionResetPreset = "seed",
): SessionState {
  const blank: SessionState = {
    sessionId,
    currentRequest: null,
    pendingApproval: null,
    lastApproval: null,
    lastRideOptions: [],
    appointment: null,
    lastBooking: null,
    lastMedicationReminder: null,
    lastHospitalVisit: null,
    tasks: [],
    caretakerActivity: [],
    careSignal: seedCareSignal(),
    consentGranted: false,
    conversation: emptyConversationState(),
  };
  if (preset === "live-demo") {
    const live = getMariaLiveDemoSession();
    return {
      ...blank,
      appointment: live.appointment,
      lastRideOptions: live.lastRideOptions,
      lastBooking: live.lastBooking,
      lastApproval: live.lastApproval,
      lastMedicationReminder: live.lastMedicationReminder,
      lastHospitalVisit: live.lastHospitalVisit,
      tasks: live.tasks,
      caretakerActivity: live.caretakerActivity,
      consentGranted: live.consentGranted,
      conversation: live.conversation,
    };
  }
  if (sessionId !== DEFAULT_SESSION_ID) {
    return blank;
  }
  const demo = getMariaDemoSession();
  return {
    ...blank,
    appointment: demo.appointment,
    lastRideOptions: demo.lastRideOptions,
    lastBooking: demo.lastBooking,
    lastApproval: demo.lastApproval,
    lastMedicationReminder: demo.lastMedicationReminder,
    lastHospitalVisit: demo.lastHospitalVisit,
    tasks: demo.tasks,
    caretakerActivity: demo.caretakerActivity,
    consentGranted: demo.consentGranted,
    conversation: demo.conversation,
  };
}

function eventsFor(sessionId: string): AuditEvent[] {
  return auditLog.list().filter((event) => event.whoAsked.sessionId === sessionId);
}

function toView(state: SessionState): SessionView {
  const events = eventsFor(state.sessionId);
  const parsed = sessionViewSchema.parse({
    ...state,
    events,
    caretakerNarrative: [],
  });
  return {
    ...parsed,
    caretakerNarrative: generateCaretakerNarrative(parsed),
  };
}

function appendCaretakerActivity(
  state: SessionState,
  input: unknown,
  event: AuditEvent,
  sent: boolean,
): void {
  const draft = withNotifyRecipient(notifyCaretakerInputSchema.parse(input));
  state.caretakerActivity.push({
    id: event.id,
    timestamp: event.timestamp,
    summary: draft.summary,
    urgency: draft.urgency,
    recipientId: draft.recipientId,
    recipientName: draft.recipientName,
    sent,
    preview: !sent,
  });
}

function notifyDraftFields(input: unknown, pending?: PendingApproval | null): Pick<
  LastApproval,
  "preview" | "recipientName" | "urgency"
> {
  const parsed = notifyCaretakerInputSchema.safeParse(input ?? pending?.input);
  if (!parsed.success) {
    return { preview: pending?.preview };
  }
  const draft = withNotifyRecipient(parsed.data);
  return {
    preview: draft.summary,
    recipientName: draft.recipientName,
    urgency: draft.urgency,
  };
}

function clearNotifyPreviews(state: SessionState): void {
  for (const item of state.caretakerActivity) {
    if (item.preview && !item.sent) {
      item.preview = false;
    }
  }
}

export type SessionStore = {
  get: (sessionId: string) => SessionView;
  /** Conversation memory for the voice loop, without the audit projection. */
  getConversation: (sessionId: string) => ConversationState;
  applyToolEvent: (input: ApplyToolEventInput) => SessionView;
  applyConversationTurn: (input: ApplyConversationTurnInput) => SessionView;
  startOrSelectChat: (input: { sessionId: string; chatId?: string; timestamp?: string }) => SessionView;
  declinePending: (input: { sessionId: string; actor: Actor }) => SessionView;
  reset: (sessionId: string, preset?: SessionResetPreset) => SessionView;
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
      extraKasamaTexts,
      skipKasamaTurn,
      chatId,
    }) {
      const state = getOrCreate(sessionId);
      const conversation = state.conversation;
      if (chatId) {
        selectChat(conversation, chatId);
      }
      const chat = ensureActiveChat(conversation, timestamp);

      chat.turns.push({
        id: nextTurnId(),
        timestamp,
        speaker: "senior",
        text: seniorText,
      });
      if (!skipKasamaTurn) {
        for (const extra of extraKasamaTexts ?? []) {
          chat.turns.push({
            id: nextTurnId(),
            timestamp,
            speaker: "kasama",
            text: extra,
          });
        }
        chat.turns.push({
          id: nextTurnId(),
          timestamp,
          speaker: "kasama",
          text: kasamaText,
          kind,
        });
      }
      applyChatTitleFromRequest(chat, activeRequest);
      conversation.turns = chat.turns;

      // The clarification budget is per request: it grows while Kasama is still
      // gathering and resets once the request resolves (proposal, answer, or dropped).
      if (askedClarification) {
        conversation.clarificationsAsked += 1;
      } else if (activeRequest === null || activeRequest === undefined || activeRequest.status !== "gathering") {
        conversation.clarificationsAsked = 0;
      }
      conversation.activeRequest = activeRequest;
      conversation.plan = plan;
      conversation.failure = failure;

      return toView(state);
    },
    startOrSelectChat({ sessionId, chatId, timestamp }) {
      const state = getOrCreate(sessionId);
      const when = timestamp ?? new Date().toISOString();
      if (chatId) {
        const selected = selectChat(state.conversation, chatId);
        if (!selected) {
          return toView(state);
        }
        return toView(state);
      }
      startNewChat(state.conversation, when);
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

      if (tool === "save_medication_reminder" && result) {
        const reminderResult = saveMedicationReminderResultSchema.safeParse(result);
        if (reminderResult.success && reminderResult.data.healthSyncError) {
          const parsed = saveMedicationReminderInputSchema.parse(input);
          const localInput = { ...parsed, saveLocally: true };
          state.lastMedicationReminder = {
            name: parsed.name,
            frequency: parsed.frequency,
            intervalDays: parsed.intervalDays,
            status: "sync_failed",
          };
          state.pendingApproval = {
            tool,
            input: localInput,
            reason: "health_sync_failed",
            summary: reminderResult.data.summary,
            timestamp: event.timestamp,
            status: "pending",
            ...describePendingApproval({
              tool,
              toolInput: localInput,
            }),
          };
          return toView(state);
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

      if (tool === "notify_caretaker") {
        const notifyResult = notifyCaretakerResultSchema.safeParse(result);
        if (!notifyResult.success || notifyResult.data.sent !== true) {
          if (state.pendingApproval?.tool === "notify_caretaker") {
            state.pendingApproval = {
              ...state.pendingApproval,
              reason: "send_failed",
              summary:
                notifyResult.success && notifyResult.data.summary
                  ? notifyResult.data.summary
                  : "Failed to send the family note.",
              timestamp: event.timestamp,
            };
          }
          clearNotifyPreviews(state);
          return toView(state);
        }
      }

      const notifyFields = tool === "notify_caretaker" ? notifyDraftFields(input, state.pendingApproval) : {};
      const notifySummary = notifyFields.preview;

      if (state.pendingApproval?.tool === tool) {
        state.lastApproval = {
          tool,
          action: state.pendingApproval.action,
          decision: "approved",
          actor,
          timestamp: event.timestamp,
          summary: notifySummary ?? decision.summary,
          prompt: state.pendingApproval.prompt,
          ...notifyFields,
        };
        state.pendingApproval = null;
      } else if (
        tool === "book_ride" ||
        tool === "notify_caretaker" ||
        tool === "save_medication_reminder" ||
        tool === "save_hospital_visit"
      ) {
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
          summary: notifySummary ?? decision.summary,
          prompt: described.prompt,
          ...notifyFields,
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
        const notifyResult = notifyCaretakerResultSchema.safeParse(result);
        if (notifyResult.success && notifyResult.data.sent === true) {
          appendCaretakerActivity(state, input, event, true);
        }
      }

      if (tool === "save_medication_reminder" && result) {
        const reminderResult = saveMedicationReminderResultSchema.safeParse(result);
        if (reminderResult.success && reminderResult.data.success) {
          const parsed = saveMedicationReminderInputSchema.parse(input);
          state.lastMedicationReminder = {
            name: parsed.name,
            frequency: parsed.frequency,
            intervalDays: parsed.intervalDays,
            status: "saved",
            savedLocally: reminderResult.data.savedLocally,
          };
          state.tasks.push({
            id: reminderResult.data.confirmationId ?? event.id,
            kind: "medication_reminder",
            title: parsed.name,
            detail: parsed.frequency,
            timestamp: event.timestamp,
            savedLocally: reminderResult.data.savedLocally,
          });
          state.conversation.activeRequest = null;
        }
      }

      if (tool === "save_hospital_visit" && result) {
        const visitResult = saveHospitalVisitResultSchema.safeParse(result);
        if (visitResult.success && visitResult.data.success) {
          const parsed = saveHospitalVisitInputSchema.parse(input);
          state.lastHospitalVisit = {
            ...parsed,
            status: "saved",
          };
          state.tasks.push({
            id: visitResult.data.confirmationId ?? event.id,
            kind: "hospital_visit",
            title: parsed.placeName,
            detail: `${parsed.reason} · ${parsed.timeLabel}`,
            timestamp: event.timestamp,
          });
          state.conversation.activeRequest = null;
        }
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
          : pending.tool === "save_medication_reminder"
            ? "The medication reminder was declined. Nothing was saved. Kasama did not change any medication."
            : pending.tool === "save_hospital_visit"
              ? "The hospital appointment was declined. Nothing was saved."
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
      const notifyFields =
        pending.tool === "notify_caretaker" ? notifyDraftFields(pending.input, pending) : {};
      state.lastApproval = {
        tool: pending.tool,
        action: pending.action,
        decision: "declined",
        actor,
        timestamp: event.timestamp,
        summary,
        prompt: pending.prompt,
        ...notifyFields,
      };
      state.pendingApproval = null;
      state.conversation.activeRequest = null;
      if (pending.tool === "save_medication_reminder") {
        const parsed = saveMedicationReminderInputSchema.safeParse(pending.input);
        if (parsed.success) {
          state.lastMedicationReminder = {
            name: parsed.data.name,
            frequency: parsed.data.frequency,
            intervalDays: parsed.data.intervalDays,
            status: "cancelled",
          };
        }
      }
      if (pending.tool === "save_hospital_visit") {
        const parsed = saveHospitalVisitInputSchema.safeParse(pending.input);
        if (parsed.success) {
          state.lastHospitalVisit = { ...parsed.data, status: "cancelled" };
        }
      }
      return toView(state);
    },
    reset(sessionId, preset = "seed") {
      auditLog.clearSession(sessionId);
      sessions.delete(sessionId);
      const created = emptyState(sessionId, preset);
      sessions.set(sessionId, created);
      return toView(created);
    },
    clear() {
      sessions.clear();
      turnCounter = 0;
    },
  };
}

export const sessionStore = createSessionStore();
