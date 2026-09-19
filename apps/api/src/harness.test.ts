import { beforeEach, describe, expect, it } from "vitest";
import {
  MARIA_PROFILE,
  computeArrivalTarget,
  emptyConversationState,
  getMariaAppointment,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runHarnessTurn } from "./harness";
import type { ChatAssistantMessage, ChatComplete } from "./model";
import { sessionStore } from "./session-store";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
});

const NOW = new Date();

function assistantText(content: string): ChatAssistantMessage {
  return { role: "assistant", content };
}

function assistantTools(calls: Array<{ name: string; args: unknown }>): ChatAssistantMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: calls.map((call, index) => ({
      id: `call_${index + 1}`,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })),
  };
}

function scripted(replies: ChatAssistantMessage[]): ChatComplete {
  let index = 0;
  return async () => {
    const next = replies[index];
    index += 1;
    if (!next) throw new Error("unexpected extra ChatGPT call");
    return next;
  };
}

describe("runHarnessTurn", () => {
  it("runs calendar then ride search when ChatGPT requests them", async () => {
    const appointment = getMariaAppointment(NOW);
    const complete = scripted([
      assistantTools([{ name: "get_appointment", args: { date: appointment.start } }]),
      assistantTools([
        {
          name: "find_ride_options",
          args: {
            pickup: appointment.pickup,
            destination: appointment.destination,
            arriveBy: computeArrivalTarget(appointment),
            accessibilityNeeds: MARIA_PROFILE.accessibilityNeeds,
          },
        },
      ]),
      assistantText(
        "Your checkup with Dr. Chen is tomorrow at 10:30 AM. I can have an Uber pick you up at home. Should I set that up?",
      ),
    ]);

    const result = await runHarnessTurn({
      transcript: "Book me a ride to my doctor tomorrow",
      sessionId: "harness-1",
      state: emptyConversationState(),
      now: NOW,
      complete,
    });

    expect(result.kind).toBe("proposal");
    expect(result.text).toContain("Dr. Chen");
    expect(result.text).toContain("Uber");
    expect(result.activeRequest).toMatchObject({
      intent: "ride",
      appointmentId: "appt_maria_doctor_01",
      status: "proposed",
    });
    expect(result.plan.steps.map((step) => step.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
    expect(result.plan.steps.every((step) => step.status === "ok")).toBe(true);
    expect(result.failure).toBeNull();
    expect(auditLog.list().map((event) => event.proposed.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
    expect(auditLog.list().every((event) => event.whoAsked.actor === "model")).toBe(true);
  });

  it("does not book when ChatGPT calls book_ride — policy denies it", async () => {
    const appointment = getMariaAppointment(NOW);
    const complete = scripted([
      assistantTools([{ name: "get_appointment", args: { date: appointment.start } }]),
      assistantTools([
        {
          name: "find_ride_options",
          args: {
            pickup: appointment.pickup,
            destination: appointment.destination,
            arriveBy: computeArrivalTarget(appointment),
          },
        },
      ]),
      assistantTools([{ name: "book_ride", args: { optionId: "uberx_1" } }]),
      assistantText("Your Uber is booked."),
    ]);

    const result = await runHarnessTurn({
      transcript: "Book the ride",
      sessionId: "harness-2",
      state: emptyConversationState(),
      now: NOW,
      complete,
    });

    expect(result.plan.steps.map((step) => `${step.tool}:${step.status}`)).toContain(
      "book_ride:denied",
    );
    expect(result.failure).toBeNull();
    expect(sessionStore.get("harness-2").lastBooking).toBeNull();
    expect(result.activeRequest?.status).toBe("proposed");
    expect(result.kind).toBe("proposal");
    expect(result.text).toContain("confirm");
    expect(result.text).not.toContain("Your Uber is booked");
  });

  it("marks a failed tool as retry, not a fake booking", async () => {
    const complete = scripted([
      assistantTools([{ name: "get_appointment", args: { date: "" } }]),
      assistantText("I couldn't look that up."),
    ]);

    const result = await runHarnessTurn({
      transcript: "When is my appointment?",
      sessionId: "harness-3",
      state: emptyConversationState(),
      now: NOW,
      complete,
    });

    expect(result.plan.steps[0]).toMatchObject({ tool: "get_appointment", status: "failed" });
    expect(result.failure).toMatchObject({ kind: "retry", tool: "get_appointment" });
    expect(result.kind).toBe("answer");
  });

  it("accepts a spoken yes against the remembered proposal without booking", async () => {
    const complete = scripted([assistantText("Okay. You'll confirm on the screen before anything is booked.")]);

    const result = await runHarnessTurn({
      transcript: "Yes please",
      sessionId: "harness-4",
      state: {
        ...emptyConversationState(),
        activeRequest: {
          intent: "ride",
          destination: "Springfield Family Medicine",
          appointmentId: "appt_maria_doctor_01",
          status: "proposed",
        },
      },
      now: NOW,
      complete,
    });

    expect(result.kind).toBe("answer");
    expect(result.activeRequest?.status).toBe("accepted");
    expect(result.plan.steps).toEqual([]);
    expect(auditLog.list().map((event) => event.proposed.tool)).not.toContain("book_ride");
  });
});
