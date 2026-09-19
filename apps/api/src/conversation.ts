import {
  DEMO_UBER_WAV_OPTION_ID,
  MAX_CLARIFICATIONS_PER_REQUEST,
  MARIA_PROFILE,
  bookingApprovalPrompt,
  conversationTurnRequestSchema,
  conversationTurnResponseSchema,
  findRideOptionsResultSchema,
  getAppointmentResultSchema,
  getMariaAppointment,
  notifyApprovalPrompt,
  resolveSessionId,
  type ActiveRequest,
  type Appointment,
  type ConversationReplyKind,
  type ConversationState,
  type ConversationTurnResponse,
} from "@kasama/shared";
import { resolvePendingApproval } from "./approval";
import { planFromAuditEvents, runHarnessTurn, type HarnessTurnResult } from "./harness";
import { invokeTool } from "./invoke-tool";
import { openaiChatComplete, type ChatComplete } from "./model";
import { auditLog } from "./audit-log";
import { sessionStore } from "./session-store";

/**
 * One conversational turn for the voice loop (#4) and harness (#5).
 *
 * ChatGPT plans when `MODEL_API_KEY` is set (or a complete function is injected).
 * Otherwise the original rules-based turn runs so the demo works without a key.
 * Every tool call still goes through `invokeTool` so policy and audit stay real.
 */

export type ConversationTurnDeps = {
  now?: Date;
  complete?: ChatComplete;
};

export type ConversationHttpResult = {
  status: 200 | 400;
  body: Record<string, unknown>;
};

const YES = /\b(yes|yeah|yep|yup|sure|please do|ok|okay|go ahead|that works|sounds good|do it|book it)\b/;
const NO = /\b(no|nope|don'?t|do not|cancel|never ?mind|stop|not now)\b/;
const RIDE = /\b(ride|uber|car|taxi|cab|drive|driver|take me|get me to|bring me|pick me up|lift)\b/;
const DOCTOR = /\b(doctor'?s?|dr\.?|appointment|check ?up|clinic|chen|physician)\b/;
const APPOINTMENT_INFO = /\b(what time|when is|when'?s|what day|do i have|remind me)\b/;
const VAGUE_PLACE = /\b(somewhere|anywhere|i don'?t know|not sure|dunno|um+|uh+)\b/;
const NOTIFY =
  /\b(tell|text|message|notify|let (my )?(family|son|daughter|james|caretaker) know)\b/;

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}'\s.-]/gu, " ").replace(/\s+/g, " ").trim();
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateFromWords(text: string, now: Date): string | undefined {
  if (/\btomorrow\b/.test(text)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return isoDate(d);
  }
  if (/\btoday\b/.test(text)) {
    return isoDate(now);
  }
  return undefined;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function describeDay(iso: string, now: Date): string {
  const target = isoDate(new Date(iso));
  if (target === isoDate(now)) return "today";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (target === isoDate(tomorrow)) return "tomorrow";
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long" });
}

/** "Dr. Chen — annual checkup" → "checkup with Dr. Chen"; falls back to the title. */
function describeAppointment(appointment: Appointment): string {
  const [who, what] = appointment.title.split("—").map((part) => part.trim());
  if (who && what) return `${what} with ${who}`;
  return appointment.title;
}

/** `date` is YYYY-MM-DD. Sent as local noon so the calendar-day match is unambiguous. */
function lookupAppointment(sessionId: string, date: string): Appointment | null {
  const result = invokeTool("get_appointment", {
    input: { date: `${date}T12:00:00` },
    actor: "model",
    sessionId,
  });
  if (result.status !== 200) return null;
  return getAppointmentResultSchema.parse(result.body).appointment ?? null;
}

function pickBookingOption(sessionId: string): { optionId: string; estimate?: string } {
  const wav = sessionStore
    .get(sessionId)
    .lastRideOptions.find((option) => option.product === "WAV" || option.accessible);
  const option = wav ?? sessionStore.get(sessionId).lastRideOptions[0];
  return {
    optionId: option?.optionId ?? DEMO_UBER_WAV_OPTION_ID,
    estimate: option?.estimate,
  };
}

function openBookingCheckpoint(sessionId: string, active: ActiveRequest): HarnessTurnResult {
  const before = auditLog.list().length;
  const { optionId } = pickBookingOption(sessionId);
  invokeTool("book_ride", {
    input: { optionId },
    actor: "model",
    sessionId,
  });
  const pending = sessionStore.get(sessionId).pendingApproval;
  return {
    text: pending?.prompt ?? bookingApprovalPrompt(pending?.estimate),
    kind: "proposal",
    activeRequest: { ...active, status: "accepted" },
    askedClarification: false,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: null,
  };
}

function draftNotifySummary(transcript: string): string {
  if (DOCTOR.test(normalize(transcript))) {
    return "Maria is going to her doctor's appointment.";
  }
  return `Maria asked me to let you know: ${transcript.trim()}`;
}

function openNotifyCheckpoint(sessionId: string, summary: string): HarnessTurnResult {
  const before = auditLog.list().length;
  invokeTool("notify_caretaker", {
    input: { summary, urgency: "normal" },
    actor: "model",
    sessionId,
  });
  const pending = sessionStore.get(sessionId).pendingApproval;
  const preview = pending?.preview ?? summary;
  return {
    text: `${preview} ${pending?.prompt ?? notifyApprovalPrompt()}`,
    kind: "proposal",
    activeRequest: sessionStore.getConversation(sessionId).activeRequest,
    askedClarification: false,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: null,
  };
}

function maybeOpenBookingCheckpoint(sessionId: string, decided: HarnessTurnResult): HarnessTurnResult {
  if (decided.activeRequest?.intent !== "ride" || decided.activeRequest.status !== "accepted") {
    return applyPendingPrompt(sessionId, decided);
  }
  if (sessionStore.get(sessionId).pendingApproval) {
    return applyPendingPrompt(sessionId, decided);
  }
  const opened = openBookingCheckpoint(sessionId, decided.activeRequest);
  return {
    ...opened,
    plan: { steps: [...decided.plan.steps, ...opened.plan.steps] },
    failure: decided.failure,
  };
}

function applyPendingPrompt(sessionId: string, decided: HarnessTurnResult): HarnessTurnResult {
  const pending = sessionStore.get(sessionId).pendingApproval;
  if (!pending?.prompt) return decided;
  const text =
    pending.preview && pending.tool === "notify_caretaker"
      ? `${pending.preview} ${pending.prompt}`
      : pending.prompt;
  return {
    ...decided,
    text,
    kind: "proposal",
    activeRequest:
      decided.activeRequest ??
      (pending.tool === "book_ride" ? { intent: "ride", status: "accepted" } : decided.activeRequest),
  };
}

function searchRides(sessionId: string, destination: string, arriveBy: string): void {
  const result = invokeTool("find_ride_options", {
    input: {
      pickup: getMariaAppointment().pickup,
      destination,
      arriveBy,
      accessibilityNeeds: MARIA_PROFILE.accessibilityNeeds,
    },
    actor: "model",
    sessionId,
  });
  if (result.status === 200) {
    findRideOptionsResultSchema.parse(result.body);
  }
}

type Reply = {
  text: string;
  kind: ConversationReplyKind;
  activeRequest: ActiveRequest | null;
  askedClarification?: boolean;
};

function proposeRideToAppointment(
  sessionId: string,
  appointment: Appointment,
  now: Date,
  preface = "",
): Reply {
  const start = new Date(appointment.start);
  const pickupAt = new Date(start);
  pickupAt.setMinutes(pickupAt.getMinutes() - 30);
  const arriveBy = new Date(start);
  arriveBy.setMinutes(arriveBy.getMinutes() - 15);
  const destination = appointment.location ?? "your appointment";

  searchRides(sessionId, destination, arriveBy.toISOString());

  const day = describeDay(appointment.start, now);
  const text =
    `${preface}Your ${describeAppointment(appointment)} is ${day} at ${formatTime(appointment.start)}. ` +
    `I can have an Uber pick you up at home around ${formatTime(pickupAt.toISOString())} so you arrive with time to spare. ` +
    "Should I set that up?";

  return {
    text,
    kind: "proposal",
    activeRequest: {
      intent: "ride",
      destination,
      date: isoDate(start),
      appointmentId: appointment.id,
      status: "proposed",
    },
  };
}

function decide(
  sessionId: string,
  transcript: string,
  state: ConversationState,
  now: Date,
): Reply {
  const text = normalize(transcript);
  const active = state.activeRequest;
  const saysYes = YES.test(text);
  const saysNo = NO.test(text);

  // Answering a ride proposal.
  if (active?.intent === "ride" && active.status === "proposed") {
    if (saysNo) {
      return {
        text: "No problem. I won't set up a ride. Is there anything else you need?",
        kind: "answer",
        activeRequest: null,
      };
    }
    if (saysYes) {
      return {
        text: "Okay. I'll get the Uber ready. You'll see it on screen and confirm before anything is booked.",
        kind: "answer",
        activeRequest: { ...active, status: "accepted" },
      };
    }
  }

  if (NOTIFY.test(text) && !RIDE.test(text)) {
    const opened = openNotifyCheckpoint(sessionId, draftNotifySummary(transcript));
    return {
      text: opened.text,
      kind: opened.kind,
      activeRequest: opened.activeRequest,
    };
  }

  // Appointment question ("what time is my appointment").
  if (APPOINTMENT_INFO.test(text) && DOCTOR.test(text)) {
    const date = dateFromWords(text, now) ?? isoDate(new Date(getMariaAppointment(now).start));
    const appointment = lookupAppointment(sessionId, date);
    if (!appointment) {
      const next = lookupAppointment(sessionId, isoDate(new Date(getMariaAppointment(now).start)));
      const nextText = next
        ? ` Your next one is ${describeAppointment(next)} ${describeDay(next.start, now)} at ${formatTime(next.start)}.`
        : "";
      return {
        text: `I don't see a doctor's appointment ${describeDay(`${date}T12:00:00`, now)}.${nextText}`,
        kind: "answer",
        activeRequest: active,
      };
    }
    return {
      text: `Your ${describeAppointment(appointment)} is ${describeDay(appointment.start, now)} at ${formatTime(appointment.start)}${appointment.location ? `, at ${appointment.location}` : ""}.`,
      kind: "answer",
      activeRequest: active,
    };
  }

  const answeringWhere = active?.intent === "ride" && active.status === "gathering";

  if (RIDE.test(text) || answeringWhere) {
    if (answeringWhere && saysNo) {
      return {
        text: "Okay, no ride for now. Just ask again when you're ready.",
        kind: "answer",
        activeRequest: null,
      };
    }

    if (DOCTOR.test(text)) {
      const seed = getMariaAppointment(now);
      const requestedDate = dateFromWords(text, now) ?? active?.date ?? isoDate(new Date(seed.start));
      const appointment = lookupAppointment(sessionId, requestedDate);
      if (appointment) {
        return proposeRideToAppointment(sessionId, appointment, now);
      }
      const next = lookupAppointment(sessionId, isoDate(new Date(seed.start)));
      if (next) {
        return proposeRideToAppointment(
          sessionId,
          next,
          now,
          `I don't see a doctor's appointment ${describeDay(`${requestedDate}T12:00:00`, now)}. `,
        );
      }
    }

    const looksLikeAPlace = !saysYes && !RIDE.test(text) && !VAGUE_PLACE.test(text);
    if (answeringWhere && looksLikeAPlace) {
      // Free-form destination from the clarification answer.
      const destination = transcript.trim().replace(/[.!?]+$/, "");
      const arriveBy = new Date(now);
      arriveBy.setMinutes(arriveBy.getMinutes() + 30);
      searchRides(sessionId, destination, arriveBy.toISOString());
      return {
        text: `I can have an Uber pick you up at home and take you to ${destination}. Should I set that up?`,
        kind: "proposal",
        activeRequest: {
          intent: "ride",
          destination,
          date: isoDate(now),
          status: "proposed",
        },
      };
    }

    if (state.clarificationsAsked < MAX_CLARIFICATIONS_PER_REQUEST) {
      return {
        text: "Of course. Where would you like to go?",
        kind: "clarification",
        activeRequest: { intent: "ride", status: "gathering", date: dateFromWords(text, now) },
        askedClarification: true,
      };
    }

    return {
      text: "I couldn't work out where you'd like to go, so I'll leave it for now. Just ask again when you're ready.",
      kind: "answer",
      activeRequest: null,
    };
  }

  return {
    text: "I can get you a ride to your appointments, or tell you when your next appointment is. What would you like?",
    kind: "answer",
    activeRequest: active,
  };
}

function runRulesTurn(
  sessionId: string,
  transcript: string,
  state: ConversationState,
  now: Date,
): HarnessTurnResult {
  const before = auditLog.list().length;
  const reply = decide(sessionId, transcript, state, now);
  const plan = planFromAuditEvents(auditLog.list().slice(before));
  const failed = plan.steps.find((step) => step.status === "failed");
  return {
    text: reply.text,
    kind: reply.kind,
    activeRequest: reply.activeRequest,
    askedClarification: reply.askedClarification ?? false,
    plan,
    failure: failed ? { kind: "retry", tool: failed.tool, summary: failed.summary } : null,
  };
}

export async function runConversationTurn(
  raw: unknown,
  deps: ConversationTurnDeps | Date = {},
): Promise<ConversationHttpResult> {
  const options: ConversationTurnDeps = deps instanceof Date ? { now: deps } : deps;
  const now = options.now ?? new Date();
  const request = conversationTurnRequestSchema.safeParse(raw);
  if (!request.success) {
    return {
      status: 400,
      body: { success: false, summary: "Invalid request.", issues: request.error.issues },
    };
  }

  const sessionId = resolveSessionId(request.data.sessionId);
  const state = sessionStore.getConversation(sessionId);
  const complete =
    options.complete ?? (process.env.MODEL_API_KEY?.trim() ? openaiChatComplete : undefined);

  const pending = sessionStore.get(sessionId).pendingApproval;
  const spoken = normalize(request.data.transcript);
  const saysYes = YES.test(spoken);
  const saysNo = NO.test(spoken);

  let decided: HarnessTurnResult;
  if (pending && (saysYes || saysNo)) {
    const resolved = resolvePendingApproval({
      sessionId,
      actor: request.data.actor,
      decision: saysNo ? "decline" : "approve",
    });
    decided = {
      text: resolved.reply,
      kind: "answer",
      activeRequest: resolved.activeRequest,
      askedClarification: false,
      plan: resolved.plan,
      failure: null,
    };
  } else if (complete) {
    try {
      decided = maybeOpenBookingCheckpoint(
        sessionId,
        await runHarnessTurn({
          transcript: request.data.transcript,
          sessionId,
          state,
          now,
          complete,
        }),
      );
    } catch {
      decided = maybeOpenBookingCheckpoint(
        sessionId,
        runRulesTurn(sessionId, request.data.transcript, state, now),
      );
    }
  } else {
    decided = maybeOpenBookingCheckpoint(
      sessionId,
      runRulesTurn(sessionId, request.data.transcript, state, now),
    );
  }

  const view = sessionStore.applyConversationTurn({
    sessionId,
    seniorText: request.data.transcript,
    kasamaText: decided.text,
    kind: decided.kind,
    activeRequest: decided.activeRequest,
    askedClarification: decided.askedClarification,
    plan: decided.plan,
    failure: decided.failure,
    timestamp: now.toISOString(),
  });

  const body: ConversationTurnResponse = conversationTurnResponseSchema.parse({
    sessionId,
    reply: decided.text,
    kind: decided.kind,
    activeRequest: view.conversation.activeRequest,
    clarificationsAsked: view.conversation.clarificationsAsked,
    plan: view.conversation.plan,
    failure: view.conversation.failure,
    pendingApproval: view.pendingApproval,
  });
  return { status: 200, body };
}
