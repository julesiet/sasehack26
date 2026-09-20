import {
  DEMO_UBER_WAV_OPTION_ID,
  MAX_CLARIFICATIONS_PER_REQUEST,
  MARIA_PROFILE,
  bookingApprovalPrompt,
  pendingRideOptionId,
  conversationTurnRequestSchema,
  conversationTurnResponseSchema,
  findRideOptionsResultSchema,
  getAppointmentResultSchema,
  getMariaAppointment,
  notifyApprovalPrompt,
  resolveSessionId,
  saveHospitalVisitInputSchema,
  saveMedicationReminderInputSchema,
  type ActiveRequest,
  type Appointment,
  type ConversationReplyKind,
  type ConversationState,
  type ConversationTurnResponse,
} from "@kasama/shared";
import { resolvePendingApproval } from "./approval";
import {
  isCheckingFiller,
  planFromAuditEvents,
  runHarnessTurn,
  type HarnessTurnResult,
} from "./harness";
import { invokeTool } from "./invoke-tool";
import {
  looksLikeHospitalSchedule,
  looksLikeMedicationReminder,
  looksLikeMostlyTime,
  nearbyHospital,
  parseAppointmentTime,
  formatSpeakableTimeLabel,
  parseMedicationReminder,
  tidyAppointmentReason,
} from "./care-intent";
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
const RIDE = /\b(ride|uber|wav|wave|wheelchair|car|taxi|cab|drive|driver|take me|get me to|bring me|pick me up|lift)\b/;
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
  if (!appointment || !appointment.title) return "your appointment";
  const [who, what] = appointment.title.split("—").map((part) => part.trim());
  if (who && what) return `${what} with ${who}`;
  return appointment.title;
}

/** `date` is YYYY-MM-DD. Sent as local noon so the calendar-day match is unambiguous. */
async function lookupAppointment(sessionId: string, date: string): Promise<Appointment | null> {
  const result = await invokeTool("get_appointment", {
    input: { date: `${date}T12:00:00` },
    actor: "model",
    sessionId,
  });
  if (result.status !== 200) return null;
  const parsed = getAppointmentResultSchema.safeParse(result.body);
  if (!parsed.success) return null;
  const appointment = parsed.data.appointment;
  if (!appointment) return null;
  return appointment;
}

function spokenProduct(text: string): "UberX" | "WAV" | undefined {
  if (/\b(accessible|wav|wave|wheelchair)\b/.test(text)) return "WAV";
  if (/\b(cheaper|uberx|uber x|regular)\b/.test(text)) return "UberX";
  return undefined;
}

function pickBookingOption(
  sessionId: string,
  product?: "UberX" | "WAV",
): { optionId: string; estimate?: string } {
  const options = sessionStore.get(sessionId).lastRideOptions;
  if (product) {
    const preferred = options.find((option) => option.product === product);
    if (preferred) return { optionId: preferred.optionId, estimate: preferred.estimate };
  }
  const defaultOption = options.find((option) => option.product === "WAV" || option.accessible) ?? options[0];
  return {
    optionId: defaultOption?.optionId ?? DEMO_UBER_WAV_OPTION_ID,
    estimate: defaultOption?.estimate,
  };
}

async function openBookingCheckpoint(sessionId: string, active: ActiveRequest): Promise<HarnessTurnResult> {
  const before = auditLog.list().length;
  const { optionId } = pickBookingOption(sessionId, active.product);
  await invokeTool("book_ride", {
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

async function openNotifyCheckpoint(sessionId: string, summary: string): Promise<HarnessTurnResult> {
  const before = auditLog.list().length;
  await invokeTool("notify_caretaker", {
    input: { summary, urgency: "normal" },
    actor: "model",
    sessionId,
  });
  const pending = sessionStore.get(sessionId).pendingApproval;
  const preview = pending?.preview ?? summary;
  return {
    text: `${preview} ${pending?.prompt ?? notifyApprovalPrompt()}`,
    kind: "proposal",
    activeRequest: { intent: "family_update", status: "proposed" },
    askedClarification: false,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: null,
  };
}

function applySpokenProduct(
  transcript: string,
  decided: HarnessTurnResult,
  previous: ActiveRequest | null,
  sessionId: string,
): HarnessTurnResult {
  const product = spokenProduct(normalize(transcript));
  const active =
    decided.activeRequest?.intent === "ride"
      ? decided.activeRequest
      : previous?.intent === "ride"
        ? previous
        : null;
  if (!product || !active) {
    return decided;
  }
  const answeringProposal = previous?.intent === "ride" && previous.status === "proposed";
  const hasOptions = sessionStore.get(sessionId).lastRideOptions.length > 0;
  return {
    ...decided,
    activeRequest: {
      ...active,
      product,
      status: answeringProposal || hasOptions ? "accepted" : active.status,
    },
  };
}

function reminderInputFromActive(active: ActiveRequest) {
  return saveMedicationReminderInputSchema.parse({
    name: active.medicationName,
    frequency: active.frequency,
    intervalDays: active.intervalDays,
  });
}

function hospitalInputFromActive(active: ActiveRequest) {
  const hospital = nearbyHospital();
  return saveHospitalVisitInputSchema.parse({
    placeName: active.placeName ?? hospital.placeName,
    distance: active.distance ?? hospital.distance,
    reason: active.reason,
    timeLabel: formatSpeakableTimeLabel(active.timeLabel ?? ""),
  });
}

async function openCareCheckpoint(sessionId: string, decided: HarnessTurnResult): Promise<HarnessTurnResult> {
  const active = decided.activeRequest;
  if (!active) return decided;
  const pending = sessionStore.get(sessionId).pendingApproval;

  if (active.intent === "medication_reminder" && active.status === "proposed") {
    if (!active.medicationName || !active.frequency || !active.intervalDays) {
      return decided;
    }
    if (pending?.tool === "save_medication_reminder") {
      return decided;
    }
    const before = auditLog.list().length;
    await invokeTool("save_medication_reminder", {
      input: reminderInputFromActive(active),
      actor: "model",
      sessionId,
    });
    return {
      ...decided,
      kind: "proposal",
      plan: { steps: [...decided.plan.steps, ...planFromAuditEvents(auditLog.list().slice(before)).steps] },
    };
  }

  if (active.intent === "hospital_schedule" && active.status === "proposed") {
    if (!active.reason || !active.timeLabel) {
      return decided;
    }
    if (pending?.tool === "save_hospital_visit") {
      return decided;
    }
    const before = auditLog.list().length;
    await invokeTool("save_hospital_visit", {
      input: hospitalInputFromActive(active),
      actor: "model",
      sessionId,
    });
    return {
      ...decided,
      kind: "proposal",
      plan: { steps: [...decided.plan.steps, ...planFromAuditEvents(auditLog.list().slice(before)).steps] },
    };
  }

  return decided;
}

function careRulesNeeded(
  transcript: string,
  state: ConversationState,
  decided: HarnessTurnResult,
  sessionId: string,
): boolean {
  const pending = sessionStore.get(sessionId).pendingApproval;
  if (
    pending?.tool === "save_medication_reminder" ||
    pending?.tool === "save_hospital_visit" ||
    pending?.tool === "notify_caretaker"
  ) {
    return false;
  }
  if (
    decided.activeRequest?.intent === "medication_reminder" ||
    decided.activeRequest?.intent === "hospital_schedule" ||
    decided.activeRequest?.intent === "family_update"
  ) {
    return false;
  }
  const text = normalize(transcript);
  return (
    looksLikeMedicationReminder(text) ||
    looksLikeHospitalSchedule(text, RIDE.test(text)) ||
    state.activeRequest?.intent === "medication_reminder" ||
    state.activeRequest?.intent === "hospital_schedule"
  );
}

async function finishDecidedTurn(
  sessionId: string,
  transcript: string,
  state: ConversationState,
  now: Date,
  decided: HarnessTurnResult,
): Promise<HarnessTurnResult> {
  let next = await openCareCheckpoint(sessionId, await maybeOpenBookingCheckpoint(sessionId, decided));
  if (careRulesNeeded(transcript, state, next, sessionId)) {
    next = await openCareCheckpoint(
      sessionId,
      await maybeOpenBookingCheckpoint(
        sessionId,
        applySpokenProduct(transcript, await runRulesTurn(sessionId, transcript, state, now), state.activeRequest, sessionId),
      ),
    );
  }
  return next;
}

async function maybeOpenBookingCheckpoint(sessionId: string, decided: HarnessTurnResult): Promise<HarnessTurnResult> {
  if (decided.activeRequest?.intent !== "ride" || decided.activeRequest.status !== "accepted") {
    return applyPendingPrompt(sessionId, decided);
  }
  const pending = sessionStore.get(sessionId).pendingApproval;
  const spokenOptionId = pickBookingOption(sessionId, decided.activeRequest.product).optionId;
  if (pending && pendingRideOptionId(pending) === spokenOptionId) {
    return applyPendingPrompt(sessionId, decided);
  }
  if (pending && pending.tool !== "book_ride") {
    return applyPendingPrompt(sessionId, decided);
  }
  const opened = await openBookingCheckpoint(sessionId, decided.activeRequest);
  return {
    ...opened,
    plan: { steps: [...decided.plan.steps, ...opened.plan.steps] },
    failure: decided.failure,
  };
}

function applyPendingPrompt(sessionId: string, decided: HarnessTurnResult): HarnessTurnResult {
  const pending = sessionStore.get(sessionId).pendingApproval;
  if (!pending?.prompt) return decided;
  if (pending.tool === "save_medication_reminder" || pending.tool === "save_hospital_visit") {
    return { ...decided, kind: "proposal" };
  }
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

async function searchRides(sessionId: string, destination: string, arriveBy: string): Promise<void> {
  const result = await invokeTool("find_ride_options", {
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
  extraKasamaTexts?: string[];
};

function proposeRideToAppointment(
  sessionId: string,
  appointment: Appointment,
  now: Date,
  preface = "",
  spoken = "",
): Reply {
  const start = new Date(appointment.start);
  if (Number.isNaN(start.getTime())) {
    return {
      text: "I'm sorry, I couldn't find the exact time for your appointment. Should I still try to set up a ride?",
      kind: "proposal",
      activeRequest: {
        intent: "ride",
        destination: appointment.location ?? "your appointment",
        status: "proposed",
      },
    };
  }
  const arriveBy = new Date(start);
  arriveBy.setMinutes(arriveBy.getMinutes() - 15);
  const destination = appointment.location ?? "your appointment";

  searchRides(sessionId, destination, arriveBy.toISOString());

  const day = describeDay(appointment.start, now);
  const text =
    `${preface}Your ${describeAppointment(appointment)} is ${day} at ${formatTime(appointment.start)}. ` +
    `I can have an Uber pick you up at home around ${formatTime(arriveBy.toISOString())} so you arrive with time to spare. ` +
    "Should I set that up?";

  return {
    text,
    kind: "proposal",
    activeRequest: {
      intent: "ride",
      destination,
      date: isoDate(start),
      appointmentId: appointment.id,
      product: spokenProduct(spoken),
      status: "proposed",
    },
  };
}

async function decide(
  sessionId: string,
  transcript: string,
  state: ConversationState,
  now: Date,
): Promise<Reply> {
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
    const product = spokenProduct(text) ?? (saysYes ? (active.product ?? "WAV") : undefined);
    if (product) {
      return {
        text: "Okay. I'll get the Uber ready. You'll see it on screen and confirm before anything is booked.",
        kind: "answer",
        activeRequest: { ...active, product, status: "accepted" },
      };
    }
  }

  if (active?.intent === "medication_reminder") {
    if (saysNo) {
      return {
        text: "Okay. I will not add that reminder. Kasama did not change any medication.",
        kind: "answer",
        activeRequest: null,
      };
    }
    const parsed = parseMedicationReminder(text);
    if (parsed) {
      return {
        text: "I'll set that up for you.",
        kind: "proposal",
        activeRequest: {
          intent: "medication_reminder",
          status: "proposed",
          medicationName: parsed.name,
          frequency: parsed.frequency,
          intervalDays: parsed.intervalDays,
        },
      };
    }
    if (active.status === "gathering" && state.clarificationsAsked >= MAX_CLARIFICATIONS_PER_REQUEST) {
      return {
        text: "I couldn't tell which medication to remind you about. Ask again when you're ready. Kasama will not change any medication.",
        kind: "answer",
        activeRequest: null,
      };
    }
  }

  if (looksLikeMedicationReminder(text)) {
    const parsed = parseMedicationReminder(text);
    if (parsed) {
      return {
        text: "I'll set that up for you.",
        kind: "proposal",
        activeRequest: {
          intent: "medication_reminder",
          status: "proposed",
          medicationName: parsed.name,
          frequency: parsed.frequency,
          intervalDays: parsed.intervalDays,
        },
      };
    }
    if (state.clarificationsAsked < MAX_CLARIFICATIONS_PER_REQUEST) {
      return {
        text: "What medication should I remind you about, and how often? This only adds a task — Kasama will not change any medication.",
        kind: "clarification",
        activeRequest: { intent: "medication_reminder", status: "gathering" },
        askedClarification: true,
      };
    }
  }

  if (active?.intent === "hospital_schedule") {
    if (saysNo) {
      return {
        text: "Okay. I will not save that appointment. Is there anything else you need?",
        kind: "answer",
        activeRequest: null,
      };
    }
    const hospital = nearbyHospital();
    const time = parseAppointmentTime(text);
    const next: ActiveRequest = {
      ...active,
      placeName: active.placeName ?? hospital.placeName,
      distance: active.distance ?? hospital.distance,
    };
    if (!active.reason && !looksLikeMostlyTime(text)) {
      next.reason = tidyAppointmentReason(transcript);
    }
    if (time) {
      next.timeLabel = time;
    } else if (active.reason && !looksLikeMostlyTime(text) && text.length > 0) {
      next.timeLabel = formatSpeakableTimeLabel(transcript);
    }
    if (next.reason && next.timeLabel) {
      return {
        text: "I found the closest hospital.",
        kind: "proposal",
        activeRequest: { ...next, status: "proposed" },
      };
    }
    if (!next.reason) {
      return {
        text: "What is this appointment for? And is there anything you'd like the doctor to know ahead of time?",
        kind: "clarification",
        activeRequest: { ...next, status: "gathering" },
      };
    }
    return {
      text: "What time works best for you?",
      kind: "clarification",
      activeRequest: { ...next, status: "gathering" },
    };
  }

  if (looksLikeHospitalSchedule(text, RIDE.test(text))) {
    const hospital = nearbyHospital();
    const time = parseAppointmentTime(text);
    const reason = looksLikeMostlyTime(text) ? undefined : tidyAppointmentReason(transcript);
    if (reason && time) {
      return {
        text: "I found the closest hospital.",
        kind: "proposal",
        extraKasamaTexts: ["Looking for the closest hospital now."],
        activeRequest: {
          intent: "hospital_schedule",
          status: "proposed",
          placeName: hospital.placeName,
          distance: hospital.distance,
          reason,
          timeLabel: time,
        },
      };
    }
    return {
      text: "What is this appointment for? And is there anything you'd like the doctor to know ahead of time?",
      kind: "clarification",
      extraKasamaTexts: ["Looking for the closest hospital now."],
      activeRequest: {
        intent: "hospital_schedule",
        status: "gathering",
        placeName: hospital.placeName,
        distance: hospital.distance,
        ...(time ? { timeLabel: time } : {}),
      },
      askedClarification: true,
    };
  }

  if (NOTIFY.test(text) && !RIDE.test(text)) {
    return await openNotifyCheckpoint(sessionId, draftNotifySummary(transcript));
  }

  // Appointment question ("what time is my appointment").
  if (APPOINTMENT_INFO.test(text) && DOCTOR.test(text)) {
    const date = dateFromWords(text, now) ?? isoDate(new Date(getMariaAppointment(now).start));
    const appointment = await lookupAppointment(sessionId, date);
    if (!appointment) {
      const next = await lookupAppointment(sessionId, isoDate(new Date(getMariaAppointment(now).start)));
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
      const appointment = await lookupAppointment(sessionId, requestedDate);
      if (appointment) {
        return proposeRideToAppointment(sessionId, appointment, now, "", text);
      }
      const next = await lookupAppointment(sessionId, isoDate(new Date(seed.start)));
      if (next) {
        return proposeRideToAppointment(
          sessionId,
          next,
          now,
          `I don't see a doctor's appointment ${describeDay(`${requestedDate}T12:00:00`, now)}. `,
          text,
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
    text: "I can get you a ride to your appointments, set a medication reminder, or help schedule a hospital visit. What would you like?",
    kind: "answer",
    activeRequest: active,
  };
}

async function runRulesTurn(
  sessionId: string,
  transcript: string,
  state: ConversationState,
  now: Date,
): Promise<HarnessTurnResult> {
  const before = auditLog.list().length;
  const reply = await decide(sessionId, transcript, state, now);
  const plan = planFromAuditEvents(auditLog.list().slice(before));
  const failed = plan.steps.find((step) => step.status === "failed");
  return {
    text: reply.text,
    kind: reply.kind,
    activeRequest: reply.activeRequest,
    askedClarification: reply.askedClarification ?? false,
    plan,
    failure: failed ? { kind: "retry", tool: failed.tool, summary: failed.summary } : null,
    extraKasamaTexts: reply.extraKasamaTexts,
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
    const resolved = await resolvePendingApproval({
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
      failure: resolved.failure,
    };
  } else if (complete) {
    try {
      const fromModel = applySpokenProduct(
        request.data.transcript,
        await runHarnessTurn({
          transcript: request.data.transcript,
          sessionId,
          state,
          now,
          complete,
        }),
        state.activeRequest,
        sessionId,
      );
      decided = await finishDecidedTurn(
        sessionId,
        request.data.transcript,
        state,
        now,
        fromModel.plan.steps.length === 0 && isCheckingFiller(fromModel.text)
          ? await applySpokenProduct(
              request.data.transcript,
              await runRulesTurn(sessionId, request.data.transcript, state, now),
              state.activeRequest,
              sessionId,
            )
          : fromModel,
      );
    } catch {
      decided = await finishDecidedTurn(
        sessionId,
        request.data.transcript,
        state,
        now,
        await applySpokenProduct(
          request.data.transcript,
          await runRulesTurn(sessionId, request.data.transcript, state, now),
          state.activeRequest,
          sessionId,
        ),
      );
    }
  } else {
    decided = await finishDecidedTurn(
      sessionId,
      request.data.transcript,
      state,
      now,
      await applySpokenProduct(
        request.data.transcript,
        await runRulesTurn(sessionId, request.data.transcript, state, now),
        state.activeRequest,
        sessionId,
      ),
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
    extraKasamaTexts: decided.extraKasamaTexts,
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
