import { beforeEach, describe, expect, it } from "vitest";
import {
  computeArrivalTarget,
  conversationTurnResponseSchema,
  getMariaAppointment,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runConversationTurn } from "./conversation";
import { sessionStore } from "./session-store";
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
});

async function turn(transcript: string, sessionId = "voice-1") {
  const result = await runConversationTurn({ transcript, sessionId });
  expect(result.status).toBe(200);
  return conversationTurnResponseSchema.parse(result.body);
}

describe("runConversationTurn", () => {
  it("turns the demo line into a ride proposal grounded in Maria's appointment", async () => {
    const reply = await turn("Please get me a ride to my doctor tomorrow.");

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
    expect(reply.plan.steps.map((step) => step.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
    expect(reply.failure).toBeNull();
  });

  it("looks up the appointment and ride options through the audited tool path", async () => {
    await turn("Get me a ride to my doctor tomorrow");

    const tools = auditLog.list().map((event) => event.proposed.tool);
    expect(tools).toEqual(["get_appointment", "find_ride_options"]);
    expect(auditLog.list().every((event) => event.whoAsked.actor === "model")).toBe(true);
    expect(auditLog.list().every((event) => event.whoAsked.sessionId === "voice-1")).toBe(true);
  });

  it("never books a ride on its own", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes please");

    const booked = auditLog.list().find((event) => event.proposed.tool === "book_ride");
    expect(booked?.executed?.attempted).not.toBe(true);
    const view = sessionStore.get("voice-1");
    expect(view.lastBooking).toBeNull();
    expect(view.pendingApproval?.tool).toBe("book_ride");
  });

  it("opens a $24.50 booking checkpoint after Maria accepts the plan", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const reply = await turn("Yes");

    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
    expect(reply.activeRequest?.status).toBe("accepted");
    expect(reply.pendingApproval?.tool).toBe("book_ride");
    expect(reply.pendingApproval?.estimate).toBe("$24.50");
    expect(reply.pendingApproval?.prompt).toContain("Should I book it?");
    expect(sessionStore.get("voice-1").lastBooking).toBeNull();
  });

  it("books only after a second human yes", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    const reply = await turn("Yes, book it");

    expect(reply.kind).toBe("answer");
    expect(reply.pendingApproval).toBeNull();
    const view = sessionStore.get("voice-1");
    expect(view.lastBooking?.optionId).toBe("uber_wav_1");
    expect(view.lastApproval?.decision).toBe("approved");
    expect(view.lastApproval?.actor).toBe("senior");
    const booked = auditLog.list().find(
      (event) => event.proposed.tool === "book_ride" && event.executed?.attempted,
    );
    expect(booked?.whoAsked.actor).toBe("senior");
    expect(booked?.approved?.allowed).toBe(true);
  });

  it("drops the request when Maria says no to the plan", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const reply = await turn("No, never mind");

    expect(reply.kind).toBe("answer");
    expect(reply.activeRequest).toBeNull();
    expect(reply.pendingApproval).toBeNull();
  });

  it("logs a decline and does not book when Maria says no at the checkpoint", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    const reply = await turn("No, cancel");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("will not book");
    expect(reply.pendingApproval).toBeNull();
    const view = sessionStore.get("voice-1");
    expect(view.lastBooking).toBeNull();
    expect(view.pendingApproval).toBeNull();
    expect(view.lastApproval?.decision).toBe("declined");
    expect(view.lastApproval?.actor).toBe("senior");
    const declined = auditLog.list().find((event) => event.outcome.reason === "declined_by_human");
    expect(declined?.executed?.attempted).toBe(false);
    expect(declined?.proposed.tool).toBe("book_ride");
  });

  it("previews a caretaker message and only sends after yes", async () => {
    const draft = await turn("Please tell my family I am going to the doctor.");
    expect(draft.kind).toBe("proposal");
    expect(draft.pendingApproval?.tool).toBe("notify_caretaker");
    expect(draft.pendingApproval?.preview).toBeTruthy();
    expect(draft.reply).toContain("Should I send it?");
    expect(sessionStore.get("voice-1").caretakerActivity.some((item) => item.sent)).toBe(false);

    const sent = await turn("Yes");
    expect(sent.pendingApproval).toBeNull();
    const view = sessionStore.get("voice-1");
    expect(view.caretakerActivity.some((item) => item.sent)).toBe(true);
    expect(view.lastApproval?.decision).toBe("approved");
  });

  it("asks exactly one clarification when the destination is missing", async () => {
    const first = await turn("I need a ride");
    expect(first.kind).toBe("clarification");
    expect(first.reply).toContain("Where");
    expect(first.clarificationsAsked).toBe(1);
    expect(first.activeRequest?.status).toBe("gathering");

    const second = await turn("To the doctor");
    expect(second.kind).toBe("proposal");
    expect(second.reply).toContain("Dr. Chen");
    expect(second.clarificationsAsked).toBe(0);
  });

  it("does not ask a second clarification for the same request", async () => {
    await turn("I need a ride");
    const reply = await turn("Um, I want a ride somewhere");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("ask again");
    expect(reply.activeRequest).toBeNull();
    expect(reply.clarificationsAsked).toBe(0);
  });

  it("answers an appointment question without proposing a ride", async () => {
    const reply = await turn("What time is my doctor's appointment tomorrow?");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("Dr. Chen");
    expect(reply.reply).toContain("Springfield Family Medicine");
    expect(reply.activeRequest).toBeNull();
    expect(auditLog.list().map((event) => event.proposed.tool)).toEqual(["get_appointment"]);
  });

  it("redirects a same-day doctor ride to the real appointment", async () => {
    const reply = await turn("Take me to the doctor today");

    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("don't see a doctor's appointment today");
    expect(reply.reply).toContain("tomorrow");
  });

  it("falls back gently when it does not understand", async () => {
    const reply = await turn("What's the weather like?");

    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("ride");
    expect(reply.activeRequest).toBeNull();
  });

  it("records both sides of every turn in the session view", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");

    const view = sessionStore.get("voice-1");
    expect(view.conversation.turns.map((t) => t.speaker)).toEqual([
      "senior",
      "kasama",
      "senior",
      "kasama",
    ]);
    expect(view.conversation.turns[1]?.kind).toBe("proposal");
    expect(view.conversation.turns[3]?.kind).toBe("proposal");
    expect(view.conversation.turns[0]?.text).toBe("Get me a ride to my doctor tomorrow");
    expect(view.conversation.plan.steps.map((step) => step.tool)).toEqual(["book_ride"]);
  });

  it("uses the default session when none is given", async () => {
    const result = await runConversationTurn({ transcript: "Get me a ride to the doctor" });
    expect(result.status).toBe(200);
    expect(result.body.sessionId).toBe("default");
    expect(sessionStore.get("default").conversation.turns).toHaveLength(2);
  });

  it("rejects an empty transcript", async () => {
    const result = await runConversationTurn({ transcript: "   " });
    expect(result.status).toBe(400);
  });

  it("opens the WAV checkpoint when Maria chooses the accessible Uber", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const reply = await turn("Choose the accessible one");
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
    expect(reply.pendingApproval?.estimate).toBe("$24.50");
  });

  it("opens the UberX checkpoint when Maria chooses the cheaper one", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const reply = await turn("the cheaper one");
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toBe("The Uber is $18.00. Should I book it?");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uberx_1" });
    expect(reply.pendingApproval?.estimate).toBe("$18.00");
  });

  it("reads the wheelchair confirmation id after a second human yes", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    const reply = await turn("Yes, book it");
    expect(reply.reply).toBe(
      "I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.",
    );
    expect(reply.failure).toBeNull();
    expect(sessionStore.get("voice-1").lastBooking?.status).toBe("booked");
    expect(sessionStore.get("voice-1").lastBooking?.confirmationId).toBe("UBER-WAV-0001");
  });

  it("does not say booked when the confirmation cannot be proven", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    resetControlledUberProvider({ failNextVerify: true });
    const reply = await turn("Yes, book it");
    expect(reply.reply).toBe(
      "I couldn't confirm that Uber booking. Nothing was charged. We can try again.",
    );
    expect(reply.reply).not.toMatch(/booked/i);
    expect(reply.failure).toMatchObject({ kind: "retry", tool: "book_ride" });
    expect(sessionStore.get("voice-1").lastBooking).toBeNull();
  });

  it("uses the 10:15 arrival window in the ride proposal", async () => {
    const now = new Date();
    const result = await runConversationTurn(
      { transcript: "Please get me a ride to my doctor tomorrow.", sessionId: "time-1" },
      now,
    );
    const body = conversationTurnResponseSchema.parse(result.body);
    const target = new Date(computeArrivalTarget(getMariaAppointment(now))).toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    );
    const thirtyEarly = new Date(computeArrivalTarget(getMariaAppointment(now), 30)).toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      },
    );
    expect(body.reply).toContain(target);
    expect(body.reply).not.toContain(thirtyEarly);
  });

  it("remembers an accessible request until the checkpoint", async () => {
    const proposed = await turn("Get me the accessible Uber to my doctor tomorrow");
    expect(proposed.activeRequest?.product).toBe("WAV");
    const reply = await turn("Yes");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
  });

  it("falls back to rules when ChatGPT throws", async () => {
    const result = await runConversationTurn(
      { transcript: "Please get me a ride to my doctor tomorrow.", sessionId: "fallback-1" },
      {
        complete: async () => {
          throw new Error("OpenAI chat failed (500).");
        },
      },
    );
    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.kind).toBe("proposal");
    expect(body.reply).toContain("Dr. Chen");
    expect(body.plan.steps.map((step) => step.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
  });
});
