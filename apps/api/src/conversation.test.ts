import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSIO_GMAIL_SEND_TOOL,
  computeArrivalTarget,
  conversationChatResponseSchema,
  conversationTurnResponseSchema,
  getMariaAppointment,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runConversationChat, runConversationTurn } from "./conversation";
import { sessionStore } from "./session-store";
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
  process.env.KASAMA_DEMO = "";
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
    expect(sessionStore.get("voice-1").lastRideOptions.length).toBeGreaterThan(0);
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
    expect(reply.reply).not.toMatch(/\b(diagnos(?:is|e|ed)?|prescription|etiology|contraindication)\b/i);
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
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "composio_session",
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      successful: true,
      logId: "gmail_send_test",
    });

    try {
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
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("previews an email to James Alvarez from a spoken send request", async () => {
    const draft = await turn("send an email to james alvarez saying i missed my medication");
    expect(draft.kind).toBe("proposal");
    expect(draft.pendingApproval?.tool).toBe("notify_caretaker");
    expect(draft.pendingApproval?.preview).toMatch(/missed.*medication/i);
    expect(draft.reply).toContain("Preview only. Nothing is sent yet.");
    expect(draft.reply).toContain("James Alvarez, son");
    expect(draft.reply).toContain("Health information is included");
    expect(draft.reply).toContain("Should I send it?");
    const input = sessionStore.get("voice-1").pendingApproval?.input as {
      recipientName?: string;
      summary?: string;
      urgency?: string;
    };
    expect(input.recipientName).toBe("James Alvarez");
    expect(input.urgency).toBe("normal");
    expect(input.summary).toMatch(/missed her medication/i);
    expect(draft.activeRequest?.intent).toBe("family_update");
    expect(sessionStore.get("voice-1").conversation.chats.at(-1)?.title).toBe("Family update");
    expect(sessionStore.get("voice-1").caretakerActivity.some((item) => item.sent)).toBe(false);
  });

  it("keeps a ChatGPT notify draft as a family update, not a ride", async () => {
    let calls = 0;
    const result = await runConversationTurn(
      {
        transcript: "send an email to james alvarez saying i missed my medication",
        sessionId: "notify-harness",
      },
      {
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "notify_caretaker",
                    arguments: JSON.stringify({
                      summary: "Maria missed her medication reminder.",
                      urgency: "normal",
                      recipientName: "James Alvarez",
                    }),
                  },
                },
              ],
            };
          }
          return { role: "assistant", content: "I drafted a note for James." };
        },
      },
    );
    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.pendingApproval?.tool).toBe("notify_caretaker");
    expect(body.activeRequest?.intent).toBe("family_update");
    expect(sessionStore.get("notify-harness").conversation.chats[0]?.intent).toBe("family_update");
    expect(sessionStore.get("notify-harness").conversation.chats[0]?.title).toBe("Family update");
  });

  it("still drafts a family email when ChatGPT searches Uber instead", async () => {
    const appointment = getMariaAppointment();
    let calls = 0;
    const result = await runConversationTurn(
      {
        transcript: "send an email to james alvarez saying i missed my medication",
        sessionId: "notify-not-ride",
      },
      {
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "find_ride_options",
                    arguments: JSON.stringify({
                      pickup: appointment.pickup,
                      destination: appointment.destination,
                      arriveBy: computeArrivalTarget(appointment),
                    }),
                  },
                },
              ],
            };
          }
          return {
            role: "assistant",
            content: "I found two Uber options. Which one would you like?",
          };
        },
      },
    );
    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.pendingApproval?.tool).toBe("notify_caretaker");
    expect(body.activeRequest?.intent).toBe("family_update");
  });

  it("starts a family email on a new chat without retitling the seeded doctor ride", async () => {
    const started = runConversationChat({ sessionId: "default" });
    expect(started.status).toBe(200);
    const chatId = conversationChatResponseSchema.parse(started.body).chatId;
    await runConversationTurn({
      transcript: "send an email to james alvarez saying i missed my medication",
      sessionId: "default",
      chatId,
    });
    const view = sessionStore.get("default");
    const ride = view.conversation.chats.find((chat) => chat.title === "Doctor ride");
    expect(ride?.intent).toBe("ride");
    expect(view.conversation.activeChatId).toBe(chatId);
    const current = view.conversation.chats.find((chat) => chat.id === chatId);
    expect(current?.title).toBe("Family update");
    expect(current?.intent).toBe("family_update");
  });

  it("previews an email when Maria names Jules", async () => {
    const draft = await turn("send an email to jules saying I am going to the doctor");
    const input = sessionStore.get("voice-1").pendingApproval?.input as { recipientName?: string };
    expect(input.recipientName).toBe("Jules");
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
    expect(sessionStore.get("default").conversation.turns).toHaveLength(5);
  });

  it("rejects an empty transcript", async () => {
    const result = await runConversationTurn({ transcript: "   " });
    expect(result.status).toBe(400);
  });

  it("does not stop on a ChatGPT checking filler with no tools", async () => {
    const result = await runConversationTurn(
      { transcript: "Please get me a ride to my doctor tomorrow.", sessionId: "filler-1" },
      {
        complete: async () => ({
          role: "assistant",
          content: "Let me check for ride options",
        }),
      },
    );
    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.kind).toBe("proposal");
    expect(body.reply).toContain("Dr. Chen");
    expect(body.reply).toMatch(/Should I set that up\?$/);
    expect(body.reply).not.toMatch(/let me check/i);
    expect(body.plan.steps.map((step) => step.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
  });

  it("does not chat UberX and WAV after a ride search — those stay on the cards", async () => {
    const appointment = getMariaAppointment();
    let calls = 0;
    const result = await runConversationTurn(
      { transcript: "Please get me a ride to my doctor tomorrow.", sessionId: "options-chat" },
      {
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "get_appointment",
                    arguments: JSON.stringify({ date: appointment.start }),
                  },
                },
              ],
            };
          }
          if (calls === 2) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "find_ride_options",
                    arguments: JSON.stringify({
                      pickup: appointment.pickup,
                      destination: appointment.destination,
                      arriveBy: computeArrivalTarget(appointment),
                    }),
                  },
                },
              ],
            };
          }
          return {
            role: "assistant",
            content:
              "I found two Uber options: UberX for $18.00 and WAV for $24.50. Which one would you like?",
          };
        },
      },
    );

    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.kind).toBe("proposal");
    expect(body.reply).toContain("Dr. Chen");
    expect(body.reply).not.toMatch(/found two/i);
    expect(body.reply).not.toMatch(/UberX/);
    expect(body.pendingApproval).toBeNull();
    const view = sessionStore.get("options-chat");
    expect(view.lastRideOptions.map((option) => option.product)).toEqual(["UberX", "WAV"]);
    expect(view.conversation.turns.map((item) => item.speaker)).toEqual(["senior"]);
    expect(view.conversation.turns.some((item) => /found two/i.test(item.text))).toBe(false);
  });

  it("keeps a spoken 3 pm pickup when ChatGPT lists Uber options", async () => {
    const now = new Date(2026, 8, 20, 9, 0, 0);
    const appointment = getMariaAppointment(now);
    let calls = 0;
    const result = await runConversationTurn(
      { transcript: "Get me a ride to my doctor at 3 pm", sessionId: "spoken-list" },
      {
        now,
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "get_appointment",
                    arguments: JSON.stringify({ date: appointment.start }),
                  },
                },
              ],
            };
          }
          if (calls === 2) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_2",
                  type: "function",
                  function: {
                    name: "find_ride_options",
                    arguments: JSON.stringify({
                      pickup: appointment.pickup,
                      destination: appointment.destination,
                      arriveBy: computeArrivalTarget(appointment),
                    }),
                  },
                },
              ],
            };
          }
          return {
            role: "assistant",
            content: "I found two Uber options: UberX for $18.00 and WAV for $24.50. Pickup tomorrow at 10:15.",
          };
        },
      },
    );

    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.reply).toContain("3:00 PM");
    expect(body.reply).not.toMatch(/found two/i);
    expect(body.reply).not.toMatch(/\btomorrow\b/i);
    expect(new Date(body.activeRequest?.arriveBy ?? "").getHours()).toBe(15);
    const searches = auditLog.list().filter((event) => event.proposed.tool === "find_ride_options");
    expect(
      searches.some((event) => new Date(String((event.proposed.input as { arriveBy?: string }).arriveBy)).getHours() === 15),
    ).toBe(true);
  });

  it("opens the WAV checkpoint when Maria says she wants WAV", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const reply = await turn("I want WAV");
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
    expect(reply.pendingApproval?.estimate).toBe("$24.50");
  });

  it("opens the WAV card when ChatGPT only offers to propose WAV", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const result = await runConversationTurn(
      { transcript: "I want WAV", sessionId: "voice-1" },
      {
        complete: async () => ({
          role: "assistant",
          content: "I can propose the WAV for you. Should I set it up?",
        }),
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
  });

  it("opens the WAV card when the first request already names WAV", async () => {
    const reply = await turn("I want the WAV to my doctor tomorrow");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
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

  it("opens the WAV card when the first request already names accessible", async () => {
    const reply = await turn("Get me the accessible Uber to my doctor tomorrow");
    expect(reply.activeRequest?.product).toBe("WAV");
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
    expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
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

  it("opens the UberX checkpoint when harness ignores the cheaper phrase", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    const result = await runConversationTurn(
      { transcript: "the cheaper one", sessionId: "voice-1" },
      {
        complete: async () => ({
          role: "assistant",
          content: "I can set that Uber up for you.",
        }),
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uberx_1" });
    expect(reply.pendingApproval?.estimate).toBe("$18.00");
  });

  it("replaces a WAV checkpoint when ChatGPT books WAV but Maria said cheaper", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    let calls = 0;
    const result = await runConversationTurn(
      { transcript: "the cheaper one", sessionId: "voice-1" },
      {
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_wav",
                  type: "function",
                  function: {
                    name: "book_ride",
                    arguments: JSON.stringify({ optionId: "uber_wav_1" }),
                  },
                },
              ],
            };
          }
          return { role: "assistant", content: "I'll book the accessible Uber." };
        },
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.pendingApproval?.input).toEqual({ optionId: "uberx_1" });
    expect(reply.pendingApproval?.estimate).toBe("$18.00");
  });

  it("does not treat a prior booking as proof when a later approve fails", async () => {
    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    await turn("Yes, book it");
    const firstBooking = sessionStore.get("voice-1").lastBooking;
    expect(firstBooking?.confirmationId).toBe("UBER-WAV-0001");

    await turn("Get me a ride to my doctor tomorrow");
    await turn("Yes");
    resetControlledUberProvider({ failNextVerify: true });
    const reply = await turn("Yes, book it");

    expect(reply.reply).toBe(
      "I couldn't confirm that Uber booking. Nothing was charged. We can try again.",
    );
    expect(reply.reply).not.toMatch(/booked/i);
    expect(sessionStore.get("voice-1").lastBooking).toEqual(firstBooking);
  });

  it("does not write a bare every onto Tasks when ChatGPT omits the cadence", async () => {
    let calls = 0;
    const result = await runConversationTurn(
      { transcript: "Remind me to take Lisinopril every 4 days", sessionId: "freq-every" },
      {
        complete: async () => {
          calls += 1;
          if (calls === 1) {
            return {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: {
                    name: "save_medication_reminder",
                    arguments: JSON.stringify({
                      name: "Lisinopril",
                      frequency: "every",
                      intervalDays: 4,
                    }),
                  },
                },
              ],
            };
          }
          return { role: "assistant", content: "I'll set that up for you." };
        },
      },
    );
    expect(result.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(result.body);
    expect(body.pendingApproval?.tool).toBe("save_medication_reminder");
    expect(body.pendingApproval?.input).toMatchObject({
      name: "Lisinopril",
      frequency: "Every 4 days",
      intervalDays: 4,
    });
    expect(body.activeRequest).toMatchObject({
      frequency: "Every 4 days",
      intervalDays: 4,
    });
  });

  it("opens a medication reminder card without changing a prescription", async () => {
    const reply = await turn("Remind me to take Lisinopril every 4 days");
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("I'll set that up for you");
    expect(reply.activeRequest).toMatchObject({
      intent: "medication_reminder",
      medicationName: "Lisinopril",
      frequency: "Every 4 days",
      status: "proposed",
    });
    expect(reply.pendingApproval?.tool).toBe("save_medication_reminder");
    expect(reply.pendingApproval?.input).toMatchObject({
      name: "Lisinopril",
      frequency: "Every 4 days",
      intervalDays: 4,
    });
    expect(sessionStore.get("voice-1").tasks).toEqual([]);
  });

  it("fails health sync on the first yes, then saves the reminder locally", async () => {
    await turn("Remind me to take Lisinopril every 4 days");
    const failed = await turn("Yes");
    expect(failed.reply).toContain("health provider");
    expect(failed.pendingApproval?.tool).toBe("save_medication_reminder");
    expect(failed.pendingApproval?.input).toMatchObject({ saveLocally: true });
    expect(sessionStore.get("voice-1").lastMedicationReminder?.status).toBe("sync_failed");
    expect(sessionStore.get("voice-1").tasks).toEqual([]);

    const saved = await turn("Yes");
    expect(saved.pendingApproval).toBeNull();
    expect(saved.reply).toMatch(/saved the Lisinopril reminder/i);
    expect(saved.reply).toMatch(/did not change any medication/i);
    const view = sessionStore.get("voice-1");
    expect(view.lastMedicationReminder).toMatchObject({
      name: "Lisinopril",
      status: "saved",
      savedLocally: true,
    });
    expect(view.tasks).toEqual([
      expect.objectContaining({
        kind: "medication_reminder",
        title: "Lisinopril",
        detail: "Every 4 days",
        savedLocally: true,
      }),
    ]);
  });

  it("cancels a medication reminder without adding a task", async () => {
    await turn("Remind me to take Lisinopril every 4 days");
    const reply = await turn("No, cancel");
    expect(reply.pendingApproval).toBeNull();
    expect(sessionStore.get("voice-1").tasks).toEqual([]);
    expect(sessionStore.get("voice-1").lastMedicationReminder?.status).toBe("cancelled");
  });

  it("walks the hospital scheduling thread then saves local details", async () => {
    const first = await turn("Schedule an appointment at a hospital near me");
    expect(first.kind).toBe("clarification");
    expect(first.reply).toContain("What is this appointment for");
    expect(first.activeRequest?.intent).toBe("hospital_schedule");
    expect(sessionStore.get("voice-1").conversation.turns.map((turn) => turn.text)).toEqual([
      "Schedule an appointment at a hospital near me",
      "Looking for the closest hospital now.",
      first.reply,
    ]);

    const reason = await turn("Annual physical. I want to discuss my blood pressure");
    expect(reason.kind).toBe("clarification");
    expect(reason.reply).toContain("What time works best");
    expect(reason.activeRequest?.reason).toBe("Annual physical. Discuss blood pressure.");

    const proposed = await turn("Thursday at 10 AM");
    expect(proposed.kind).toBe("proposal");
    expect(proposed.reply).toContain("closest hospital");
    expect(proposed.pendingApproval?.tool).toBe("save_hospital_visit");
    expect(proposed.pendingApproval?.input).toMatchObject({
      placeName: "St. Mary's Hospital",
      distance: "0.8 miles away",
      reason: "Annual physical. Discuss blood pressure.",
      timeLabel: "Thursday at 10:00 AM",
    });

    const saved = await turn("Yes");
    expect(saved.pendingApproval).toBeNull();
    expect(saved.reply).toContain("St. Mary's Hospital");
    const view = sessionStore.get("voice-1");
    expect(view.lastHospitalVisit).toMatchObject({
      placeName: "St. Mary's Hospital",
      status: "saved",
    });
    expect(view.tasks).toEqual([
      expect.objectContaining({
        kind: "hospital_visit",
        title: "St. Mary's Hospital",
      }),
    ]);
  });

  it("shows an ISO hospital time as weekday and clock", async () => {
    await turn("Schedule an appointment");
    await turn("Annual physical");
    const proposed = await turn("2026-09-20T10:00:00.000Z");
    expect(proposed.pendingApproval?.tool).toBe("save_hospital_visit");
    expect(proposed.pendingApproval?.input).toMatchObject({
      timeLabel: "Sunday at 10:00 AM",
    });
    expect(proposed.activeRequest?.timeLabel).toBe("Sunday at 10:00 AM");
  });

  it("starts a reminder when Maria just says set a reminder", async () => {
    const reply = await turn("Set a reminder");
    expect(reply.kind).toBe("clarification");
    expect(reply.reply).toMatch(/what medication/i);
    expect(reply.activeRequest?.intent).toBe("medication_reminder");
    expect(reply.pendingApproval).toBeNull();

    const details = await turn("Lisinopril every 4 days");
    expect(details.pendingApproval?.tool).toBe("save_medication_reminder");
    expect(details.pendingApproval?.input).toMatchObject({
      name: "Lisinopril",
      frequency: "Every 4 days",
    });
  });

  it("starts hospital scheduling when Maria asks to schedule an appointment", async () => {
    const reply = await turn("I want to schedule an appointment");
    expect(reply.kind).toBe("clarification");
    expect(reply.reply).toContain("What is this appointment for");
    expect(reply.activeRequest?.intent).toBe("hospital_schedule");
    expect(reply.activeRequest?.placeName).toBe("St. Mary's Hospital");
  });

  it("does not treat an appointment lookup as a new reminder", async () => {
    const reply = await turn("Remind me what time my doctor's appointment is");
    expect(reply.kind).toBe("answer");
    expect(reply.reply).toContain("Dr. Chen");
    expect(reply.activeRequest?.intent).not.toBe("medication_reminder");
  });

  it("still opens a reminder when ChatGPT says it cannot set reminders", async () => {
    const result = await runConversationTurn(
      { transcript: "Can you set reminders?", sessionId: "chatgpt-reminder" },
      {
        complete: async () => ({
          role: "assistant",
          content: "I can't set reminders or change medication.",
        }),
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.kind).toBe("clarification");
    expect(reply.reply).toMatch(/what medication/i);
    expect(reply.reply).not.toMatch(/can't set reminders/i);
    expect(reply.activeRequest?.intent).toBe("medication_reminder");
  });

  it("still opens hospital scheduling when ChatGPT says it cannot schedule", async () => {
    const result = await runConversationTurn(
      { transcript: "Can you schedule appointments?", sessionId: "chatgpt-hosp" },
      {
        complete: async () => ({
          role: "assistant",
          content: "I cannot schedule appointments.",
        }),
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.kind).toBe("clarification");
    expect(reply.reply).toContain("What is this appointment for");
    expect(reply.reply).not.toMatch(/cannot schedule/i);
    expect(reply.activeRequest?.intent).toBe("hospital_schedule");
  });

  it("keeps the rules-based demo line when KASAMA_DEMO is set even if ChatGPT is injected", async () => {
    process.env.KASAMA_DEMO = "1";
    const result = await runConversationTurn(
      {
        transcript: "Please get me a ride to my doctor tomorrow.",
        sessionId: "demo-lock-1",
      },
      {
        complete: async () => ({
          role: "assistant",
          content: "I will diagnose your symptoms and book whatever is cheapest.",
        }),
      },
    );
    expect(result.status).toBe(200);
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("Dr. Chen");
    expect(reply.reply).toMatch(/Should I set that up\?$/);
    expect(reply.reply).not.toMatch(/diagnos|cheapest/i);
  });

  it("uses the spoken clock instead of tomorrow's seeded appointment", async () => {
    const now = new Date(2026, 8, 20, 9, 0, 0);
    const result = await runConversationTurn(
      { transcript: "Get me a ride to my doctor at 3 pm", sessionId: "spoken-time" },
      now,
    );
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.kind).toBe("proposal");
    expect(reply.reply).toContain("3:00 PM");
    expect(reply.reply).not.toMatch(/\btomorrow\b/i);
    expect(reply.reply).toMatch(/\btoday\b/i);
    expect(reply.activeRequest).toMatchObject({
      intent: "ride",
      status: "proposed",
    });
    expect(reply.activeRequest?.arriveBy).toBeDefined();
    expect(new Date(reply.activeRequest?.arriveBy ?? "").getHours()).toBe(15);
    const search = auditLog.list().find((event) => event.proposed.tool === "find_ride_options");
    expect(new Date(String((search?.proposed.input as { arriveBy?: string })?.arriveBy)).getHours()).toBe(15);
  });

  it("keeps a spoken pickup time while asking where to go", async () => {
    const now = new Date(2026, 8, 20, 9, 0, 0);
    const asked = await runConversationTurn(
      { transcript: "I need a ride at 3 pm", sessionId: "spoken-place" },
      now,
    );
    const where = conversationTurnResponseSchema.parse(asked.body);
    expect(where.kind).toBe("clarification");
    expect(where.activeRequest?.arriveBy).toBeDefined();

    const result = await runConversationTurn(
      { transcript: "the grocery store", sessionId: "spoken-place" },
      now,
    );
    const reply = conversationTurnResponseSchema.parse(result.body);
    expect(reply.reply).toContain("3:00 PM");
    expect(reply.reply).toContain("grocery store");
    expect(reply.reply).not.toMatch(/\btomorrow\b/i);
  });
});
