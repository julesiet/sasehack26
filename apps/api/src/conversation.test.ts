import { beforeEach, describe, expect, it } from "vitest";
import { conversationTurnResponseSchema } from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runConversationTurn } from "./conversation";
import { sessionStore } from "./session-store";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
});

function turn(transcript: string, sessionId = "voice-1") {
  const result = runConversationTurn({ transcript, sessionId });
  expect(result.status).toBe(200);
  return conversationTurnResponseSchema.parse(result.body);
}

describe("runConversationTurn", () => {
  it("turns the demo line into a ride proposal grounded in Maria's appointment", () => {
    const reply = turn("Please get me a ride to my doctor tomorrow.");

    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("Dr. Chen");
    expect(reply.reply).toContain("tomorrow");
    expect(reply.reply).toContain("Uber");
    expect(reply.reply).toMatch(/Should I set that up\?$/);
    expect(reply.activeRequest).toMatchObject({
      intent: "ride",
      appointmentId: "appt_maria_doctor_01",
      status: "proposed",
    });
    expect(reply.clarificationsAsked).toBe(0);
  });

  it("looks up the appointment and ride options through the audited tool path", () => {
    turn("Get me a ride to my doctor tomorrow");

    const tools = auditLog.list().map((event) => event.proposed.tool);
    expect(tools).toEqual(["get_appointment", "find_ride_options"]);
    expect(auditLog.list().every((event) => event.whoAsked.actor === "model")).toBe(true);
    expect(auditLog.list().every((event) => event.whoAsked.sessionId === "voice-1")).toBe(true);
  });

  it("never books a ride on its own", () => {
    turn("Get me a ride to my doctor tomorrow");
    turn("Yes please");

    expect(auditLog.list().map((event) => event.proposed.tool)).not.toContain("book_ride");
    const view = sessionStore.get("voice-1");
    expect(view.lastBooking).toBeNull();
  });

  it("remembers the proposal across turns so Maria can just say yes", () => {
    turn("Get me a ride to my doctor tomorrow");
    const reply = turn("Yes");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("confirm");
    expect(reply.activeRequest?.status).toBe("accepted");
  });

  it("drops the request when Maria says no", () => {
    turn("Get me a ride to my doctor tomorrow");
    const reply = turn("No, never mind");

    expect(reply.kind).toBe("answer");
    expect(reply.activeRequest).toBeNull();
  });

  it("asks exactly one clarification when the destination is missing", () => {
    const first = turn("I need a ride");
    expect(first.kind).toBe("clarification");
    expect(first.reply).toContain("Where");
    expect(first.clarificationsAsked).toBe(1);
    expect(first.activeRequest?.status).toBe("gathering");

    const second = turn("To the doctor");
    expect(second.kind).toBe("proposal");
    expect(second.reply).toContain("Dr. Chen");
    expect(second.clarificationsAsked).toBe(0);
  });

  it("does not ask a second clarification for the same request", () => {
    turn("I need a ride");
    const reply = turn("Um, I want a ride somewhere");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("ask again");
    expect(reply.activeRequest).toBeNull();
    expect(reply.clarificationsAsked).toBe(0);
  });

  it("answers an appointment question without proposing a ride", () => {
    const reply = turn("What time is my doctor's appointment tomorrow?");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("Dr. Chen");
    expect(reply.reply).toContain("Springfield Family Medicine");
    expect(reply.activeRequest).toBeNull();
    expect(auditLog.list().map((event) => event.proposed.tool)).toEqual(["get_appointment"]);
  });

  it("redirects a same-day doctor ride to the real appointment", () => {
    const reply = turn("Take me to the doctor today");

    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("don't see a doctor's appointment today");
    expect(reply.reply).toContain("tomorrow");
  });

  it("falls back gently when it does not understand", () => {
    const reply = turn("What's the weather like?");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("ride");
    expect(reply.activeRequest).toBeNull();
  });

  it("records both sides of every turn in the session view", () => {
    turn("Get me a ride to my doctor tomorrow");
    turn("Yes");

    const view = sessionStore.get("voice-1");
    expect(view.conversation.turns.map((t) => t.speaker)).toEqual([
      "senior",
      "kasama",
      "senior",
      "kasama",
    ]);
    expect(view.conversation.turns[1]?.kind).toBe("proposal");
    expect(view.conversation.turns[0]?.text).toBe("Get me a ride to my doctor tomorrow");
  });

  it("uses the default session when none is given", () => {
    const result = runConversationTurn({ transcript: "Get me a ride to the doctor" });
    expect(result.status).toBe(200);
    expect(result.body.sessionId).toBe("default");
    expect(sessionStore.get("default").conversation.turns).toHaveLength(2);
  });

  it("rejects an empty transcript", () => {
    const result = runConversationTurn({ transcript: "   " });
    expect(result.status).toBe(400);
  });
});
