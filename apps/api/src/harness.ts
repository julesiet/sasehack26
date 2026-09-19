/**
 * Kasama's harness (#5): ChatGPT proposes tools, this module decides.
 *
 * Every tool goes through `invokeTool` as `actor: "model"` so policy and audit
 * stay real. Composio is not on this loop — Gmail stays on POST /composio/*.
 */

import {
  MAX_CLARIFICATIONS_PER_REQUEST,
  MAX_TOOL_ROUNDS_PER_TURN,
  MARIA_PROFILE,
  getMariaAppointment,
  isKnownTool,
  type ActiveRequest,
  type AuditEvent,
  type ConversationFailure,
  type ConversationPlan,
  type ConversationPlanStep,
  type ConversationReplyKind,
  type ConversationState,
  type ToolName,
} from "@kasama/shared";
import { invokeTool } from "./invoke-tool";
import type { ChatComplete, ChatMessage } from "./model";

export const KASAMA_CHAT_TOOLS = [
  {
    type: "function",
    function: {
      name: "get_appointment",
      description:
        "Look up Maria's appointment on a calendar day. Use this instead of asking her to restate the appointment. Pass an ISO date (YYYY-MM-DD) or datetime.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Day to look up, ISO date or datetime.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_ride_options",
      description:
        "Search Uber options from pickup to destination arriving by arriveBy. Use Maria's home as pickup and her appointment location when she wants a ride to the doctor.",
      parameters: {
        type: "object",
        properties: {
          pickup: { type: "string" },
          destination: { type: "string" },
          arriveBy: { type: "string", description: "ISO datetime to arrive by." },
          accessibilityNeeds: { type: "array", items: { type: "string" } },
        },
        required: ["pickup", "destination", "arriveBy"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "book_ride",
      description:
        "Book an Uber option. Requires a human confirmation token. Prefer proposing the ride; the iPhone confirms booking.",
      parameters: {
        type: "object",
        properties: { optionId: { type: "string" } },
        required: ["optionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "notify_caretaker",
      description:
        "Send a message to Maria's caretaker. Requires a human confirmation token. Do not claim it was sent.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          urgency: { type: "string", enum: ["low", "normal", "high"] },
        },
        required: ["summary", "urgency"],
      },
    },
  },
] as const;

const YES = /\b(yes|yeah|yep|yup|sure|please do|ok|okay|go ahead|that works|sounds good|do it|book it)\b/i;
const NO = /\b(no|nope|don'?t|do not|cancel|never ?mind|stop|not now)\b/i;

export type HarnessTurnResult = {
  text: string;
  kind: ConversationReplyKind;
  activeRequest: ActiveRequest | null;
  askedClarification: boolean;
  plan: ConversationPlan;
  failure: ConversationFailure | null;
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function coerceAppointmentDate(input: Record<string, unknown>): Record<string, unknown> {
  const date = input.date;
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ...input, date: `${date}T12:00:00` };
  }
  return input;
}

export function planFromAuditEvents(events: AuditEvent[]): ConversationPlan {
  const steps: ConversationPlanStep[] = [];
  for (const event of events) {
    if (!isKnownTool(event.proposed.tool)) continue;
    const status = event.outcome.denied ? "denied" : event.outcome.success ? "ok" : "failed";
    steps.push({
      tool: event.proposed.tool,
      status,
      summary: event.outcome.summary,
      auditId: event.id,
    });
  }
  return { steps };
}

function systemPrompt(now: Date, state: ConversationState): string {
  const appointment = getMariaAppointment(now);
  const today = isoDate(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = isoDate(tomorrow);
  return [
    `You are Kasama, a voice-first companion for ${MARIA_PROFILE.name}.`,
    "Speak in short, simple sentences she can hear. Never diagnose. Never change medication.",
    'Care language is "worth reviewing" only — never a medical conclusion.',
    "Never say an Uber was booked or a message was sent. Those need a human yes on the iPhone.",
    "Do not call book_ride or notify_caretaker. Propose the action and wait.",
    `Today is ${today}. Tomorrow is ${tomorrowDate}. Use those calendar dates — never a past year.`,
    `Maria lives at ${appointment.pickup}. Accessibility: ${MARIA_PROFILE.accessibilityNeeds.join(", ")}.`,
    `Her next doctor visit is ${appointment.title} at ${appointment.start}, at ${appointment.destination} (lookup date ${isoDate(new Date(appointment.start))}).`,
    `When she asks for a ride to the doctor or "tomorrow", call get_appointment with ${tomorrowDate} then find_ride_options to that appointment. If the lookup is empty, use the visit above and still search rides. Do not ask her to restate the appointment.`,
    "If find_ride_options returns no live options, Uber search is still a stub — propose picking her up for the appointment anyway and ask whether you should set that up. Do not say the search failed.",
    `You may ask at most ${MAX_CLARIFICATIONS_PER_REQUEST} clarifying question per request. Already asked: ${state.clarificationsAsked}.`,
    `Active request: ${JSON.stringify(state.activeRequest)}.`,
  ].join(" ");
}

type ExecutedCall = {
  tool: ToolName;
  input: Record<string, unknown>;
  step: ConversationPlanStep;
  body: Record<string, unknown>;
};

function executeKasamaTool(
  sessionId: string,
  name: string,
  rawArgs: unknown,
): { step: ConversationPlanStep | null; content: string; executed?: ExecutedCall } {
  if (!isKnownTool(name)) {
    const content = JSON.stringify({ success: false, summary: `Unknown tool: ${name}` });
    return { step: null, content };
  }

  let input: Record<string, unknown>;
  if (rawArgs && typeof rawArgs === "object" && !Array.isArray(rawArgs)) {
    input = { ...(rawArgs as Record<string, unknown>) };
  } else {
    input = {};
  }
  if (name === "get_appointment") {
    input = coerceAppointmentDate(input);
  }

  const result = invokeTool(name, {
    input,
    actor: "model",
    sessionId,
  });
  const auditId = typeof result.body.auditId === "string" ? result.body.auditId : undefined;
  const summary =
    typeof result.body.summary === "string" ? result.body.summary : `${name} finished.`;
  const status: ConversationPlanStep["status"] =
    result.status === 403 ? "denied" : result.status === 200 && result.body.success !== false ? "ok" : "failed";
  const step: ConversationPlanStep = { tool: name, status, summary, ...(auditId ? { auditId } : {}) };
  const bodyForModel: Record<string, unknown> = { ...result.body };
  if (
    name === "find_ride_options" &&
    Array.isArray(result.body.options) &&
    result.body.options.length === 0
  ) {
    bodyForModel.note =
      "No live Uber options yet (search is stubbed). Still propose picking Maria up for the appointment and ask if you should set that up. Do not say the search failed.";
  }
  return {
    step,
    content: JSON.stringify(bodyForModel),
    executed: { tool: name, input, step, body: result.body },
  };
}

function looksLikeQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim()) || /^(where|when|what|which|who|how)\b/i.test(text.trim());
}

/** ChatGPT often narrates "Let me check…" and then stops. That is not a proposal. */
export function isCheckingFiller(text: string): boolean {
  return (
    /\b(let me (check|look|search|find)|checking|looking up|one moment|hold on|searching for)\b/i.test(
      text,
    ) && !looksLikeQuestion(text)
  );
}

function failureFromSteps(steps: ConversationPlanStep[]): ConversationFailure | null {
  const failed = steps.find((step) => step.status === "failed");
  if (!failed) return null;
  return { kind: "retry", tool: failed.tool, summary: failed.summary };
}

function inferReply(
  transcript: string,
  text: string,
  executed: ExecutedCall[],
  previous: ActiveRequest | null,
  clarificationsAsked: number,
  capped: boolean,
): Pick<HarnessTurnResult, "kind" | "activeRequest" | "askedClarification" | "failure"> {
  const steps = executed.map((item) => item.step);
  let failure = failureFromSteps(steps);
  if (capped) {
    failure = {
      kind: "handoff",
      summary: "Kasama hit the tool-round limit for this turn.",
    };
  }

  const booked = executed.find((item) => item.tool === "book_ride");
  const notified = executed.find((item) => item.tool === "notify_caretaker");
  const rideSearch = [...executed].reverse().find((item) => item.tool === "find_ride_options");
  const appointmentLookup = [...executed].reverse().find((item) => item.tool === "get_appointment");

  const destination =
    (typeof rideSearch?.input.destination === "string" ? rideSearch.input.destination : undefined) ??
    previous?.destination;

  const lookedUp = appointmentLookup?.body.appointment;
  const parsedAppointmentId =
    lookedUp && typeof lookedUp === "object" && typeof (lookedUp as { id?: unknown }).id === "string"
      ? (lookedUp as { id: string }).id
      : previous?.appointmentId;

  const appointmentDate =
    (typeof appointmentLookup?.input.date === "string"
      ? isoDate(new Date(appointmentLookup.input.date))
      : undefined) ?? previous?.date;

  if (booked || notified) {
    const denied = (booked ?? notified)?.step.status === "denied";
    if (denied) {
      const wasProposed = previous?.status === "proposed";
      return {
        kind: wasProposed ? "answer" : "proposal",
        activeRequest: {
          intent: "ride",
          ...(destination ? { destination } : {}),
          ...(appointmentDate ? { date: appointmentDate } : {}),
          ...(parsedAppointmentId ? { appointmentId: parsedAppointmentId } : {}),
          ...(previous?.product ? { product: previous.product } : {}),
          status: wasProposed ? "accepted" : "proposed",
        },
        askedClarification: false,
        failure,
      };
    }
  }

  if (rideSearch && rideSearch.step.status !== "failed") {
    return {
      kind: "proposal",
      activeRequest: {
        intent: "ride",
        ...(destination ? { destination } : {}),
        ...(appointmentDate ? { date: appointmentDate } : {}),
        ...(parsedAppointmentId ? { appointmentId: parsedAppointmentId } : {}),
        ...(previous?.product ? { product: previous.product } : {}),
        status: "proposed",
      },
      askedClarification: false,
      failure,
    };
  }

  if (appointmentLookup && !rideSearch) {
    return {
      kind: "answer",
      activeRequest: previous,
      askedClarification: false,
      failure,
    };
  }

  if (!executed.length) {
    if (previous?.intent === "ride" && previous.status === "proposed") {
      if (NO.test(transcript)) {
        return { kind: "answer", activeRequest: null, askedClarification: false, failure };
      }
      if (YES.test(transcript)) {
        return {
          kind: "answer",
          activeRequest: { ...previous, status: "accepted" },
          askedClarification: false,
          failure,
        };
      }
    }

    if (previous?.status === "gathering" || looksLikeQuestion(text)) {
      if (clarificationsAsked >= MAX_CLARIFICATIONS_PER_REQUEST && previous?.status === "gathering") {
        return {
          kind: "answer",
          activeRequest: null,
          askedClarification: false,
          failure: {
            kind: "handoff",
            summary: "Kasama could not finish gathering this request.",
          },
        };
      }
      if (looksLikeQuestion(text) && clarificationsAsked < MAX_CLARIFICATIONS_PER_REQUEST) {
        return {
          kind: "clarification",
          activeRequest: previous?.status === "gathering" ? previous : { intent: "ride", status: "gathering" },
          askedClarification: true,
          failure,
        };
      }
    }
  }

  return {
    kind: "answer",
    activeRequest: previous,
    askedClarification: false,
    failure,
  };
}

export async function runHarnessTurn(input: {
  transcript: string;
  sessionId: string;
  state: ConversationState;
  now?: Date;
  complete: ChatComplete;
}): Promise<HarnessTurnResult> {
  const now = input.now ?? new Date();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(now, input.state) },
  ];

  for (const turn of input.state.turns.slice(-8)) {
    messages.push({
      role: turn.speaker === "senior" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: input.transcript });

  const executed: ExecutedCall[] = [];
  let text = "";
  let capped = false;
  let rounds = 0;

  while (true) {
    const assistant = await input.complete({ messages, tools: KASAMA_CHAT_TOOLS });
    messages.push(assistant);
    const calls = assistant.tool_calls ?? [];
    if (calls.length === 0) {
      text = (assistant.content ?? "").trim();
      break;
    }

    rounds += 1;
    if (rounds > MAX_TOOL_ROUNDS_PER_TURN) {
      capped = true;
      text =
        "I wasn't able to finish that. A family member can help, or you can ask me again.";
      break;
    }

    for (const call of calls) {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(call.function.arguments || "{}");
      } catch {
        parsed = {};
      }
      const ran = executeKasamaTool(input.sessionId, call.function.name, parsed);
      if (ran.step && ran.executed) {
        executed.push(ran.executed);
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: ran.content,
      });
    }
  }

  const inferred = inferReply(
    input.transcript,
    text,
    executed,
    input.state.activeRequest,
    input.state.clarificationsAsked,
    capped,
  );

  if (!text) {
    if (inferred.failure?.kind === "handoff") {
      text = "I couldn't work that out, so I'll leave it for now. A family member can help, or you can ask me again.";
    } else if (inferred.failure?.kind === "retry") {
      text = "I couldn't finish that just now. We can try again, or a family member can help.";
    } else if (inferred.kind === "proposal") {
      text = "I can set up an Uber for you. Should I set that up?";
    } else {
      text = "I can get you a ride to your appointments, or tell you when your next appointment is. What would you like?";
    }
  } else if (inferred.kind === "proposal" && isCheckingFiller(text)) {
    text = "I can set up an Uber for you. Should I set that up?";
  }

  const bookedDenied = executed.some((item) => item.tool === "book_ride" && item.step.status === "denied");
  const notifyDenied = executed.some(
    (item) => item.tool === "notify_caretaker" && item.step.status === "denied",
  );
  if (bookedDenied && /\b(booked|confirmed your ride|on (its|the) way)\b/i.test(text)) {
    text = "You'll see the Uber on screen and confirm before anything is booked.";
  }
  if (notifyDenied && /\b(sent|emailed|texted|notified)\b/i.test(text)) {
    text = "I can draft a note for your family. You'll confirm before anything is sent.";
  }

  return {
    text,
    kind: inferred.kind,
    activeRequest: inferred.activeRequest,
    askedClarification: inferred.askedClarification,
    plan: { steps: executed.map((item) => item.step) },
    failure: inferred.failure,
  };
}
