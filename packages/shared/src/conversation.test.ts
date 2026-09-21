import { describe, expect, it } from "vitest";
import {
  MAX_CLARIFICATIONS_PER_REQUEST,
  allConversationTurns,
  announcesRideOptions,
  chatTitleForIntent,
  chatsNewestFirst,
  conversationTurnRequestSchema,
  conversationTurnResponseSchema,
  emptyConversationState,
  ensureActiveChat,
  speakRequestSchema,
  seniorThreadCards,
  startNewChat,
  type ConversationChat,
  type ConversationTurn,
} from "./conversation";

function turn(
  id: string,
  timestamp: string,
  speaker: ConversationTurn["speaker"],
  text: string,
): ConversationTurn {
  return { id, timestamp, speaker, text };
}

describe("conversation contract", () => {
  it("allows exactly one clarification per request", () => {
    expect(MAX_CLARIFICATIONS_PER_REQUEST).toBe(1);
  });

  it("defaults the actor to senior and trims the transcript", () => {
    const parsed = conversationTurnRequestSchema.parse({
      transcript: "  get me a ride  ",
    });
    expect(parsed.actor).toBe("senior");
    expect(parsed.transcript).toBe("get me a ride");
  });

  it("rejects an empty transcript", () => {
    expect(conversationTurnRequestSchema.safeParse({ transcript: "   " }).success).toBe(false);
  });

  it("starts with no turns, no chats, no active request, and an empty plan", () => {
    expect(emptyConversationState()).toEqual({
      turns: [],
      chats: [],
      activeChatId: null,
      activeRequest: null,
      clarificationsAsked: 0,
      plan: { steps: [] },
      failure: null,
    });
  });

  it("uses short topic labels seniors can scan", () => {
    expect(chatTitleForIntent("ride", "Springfield Family Medicine")).toBe("Doctor ride");
    expect(chatTitleForIntent("ride", "the grocery store")).toBe("Ride");
    expect(chatTitleForIntent("medication_reminder")).toBe("Medication reminder");
    expect(chatTitleForIntent("hospital_schedule")).toBe("Hospital visit");
    expect(chatTitleForIntent("family_update")).toBe("Family update");
    expect(chatTitleForIntent("unknown")).toBe("New chat");
  });

  it("lists chats with the most recently updated first", () => {
    const older: ConversationChat = {
      id: "chat_hospital",
      title: "Hospital visit",
      intent: "hospital_schedule",
      startedAt: "2026-09-18T07:15:00.000Z",
      turns: [turn("h1", "2026-09-18T07:15:00.000Z", "senior", "Schedule an appointment.")],
    };
    const current: ConversationChat = {
      id: "chat_ride",
      title: "Doctor ride",
      intent: "ride",
      startedAt: "2026-09-18T08:42:00.000Z",
      turns: [turn("r1", "2026-09-18T08:42:00.000Z", "senior", "Please get me a ride.")],
    };
    expect(chatsNewestFirst([older, current]).map((chat) => chat.id)).toEqual([
      "chat_ride",
      "chat_hospital",
    ]);
    expect(chatsNewestFirst([older, current], "chat_hospital").map((chat) => chat.id)).toEqual([
      "chat_hospital",
      "chat_ride",
    ]);
  });

  it("starts a new chat and makes it active without copying turns", () => {
    const state = emptyConversationState();
    const first = ensureActiveChat(state, "2026-09-18T08:00:00.000Z");
    first.turns.push(turn("t1", "2026-09-18T08:00:00.000Z", "senior", "Please get me a ride."));
    state.turns = first.turns;

    const started = startNewChat(state, "2026-09-18T09:00:00.000Z");
    expect(started.title).toBe("New chat");
    expect(started.turns).toEqual([]);
    expect(state.activeChatId).toBe(started.id);
    expect(state.turns).toEqual([]);
    expect(state.chats).toHaveLength(2);
    expect(state.chats[0]?.turns).toHaveLength(1);
  });

  it("flattens every chat's turns in time order for caretaker activity", () => {
    const state = emptyConversationState();
    state.chats = [
      {
        id: "chat_ride",
        title: "Doctor ride",
        intent: "ride",
        startedAt: "2026-09-18T08:42:00.000Z",
        turns: [turn("r1", "2026-09-18T08:42:00.000Z", "senior", "Ride please.")],
      },
      {
        id: "chat_meds",
        title: "Medication reminder",
        intent: "medication_reminder",
        startedAt: "2026-09-18T07:40:00.000Z",
        turns: [turn("m1", "2026-09-18T07:40:00.000Z", "senior", "Remind me.")],
      },
    ];
    expect(allConversationTurns(state).map((item) => item.id)).toEqual(["m1", "r1"]);
  });

  it("accepts a preferred Uber product on the active request", () => {
    const parsed = conversationTurnResponseSchema.parse({
      sessionId: "default",
      reply: "Should I set that up?",
      kind: "proposal",
      activeRequest: { intent: "ride", status: "proposed", product: "WAV" },
      clarificationsAsked: 0,
    });
    expect(parsed.activeRequest?.product).toBe("WAV");
  });

  it("accepts a proposal response", () => {
    const parsed = conversationTurnResponseSchema.parse({
      sessionId: "default",
      reply: "Should I set that up?",
      kind: "proposal",
      activeRequest: { intent: "ride", status: "proposed" },
      clarificationsAsked: 0,
    });
    expect(parsed.kind).toBe("proposal");
    expect(parsed.plan).toEqual({ steps: [] });
    expect(parsed.failure).toBeNull();
    expect(parsed.pendingApproval).toBeNull();
  });

  it("accepts a booking checkpoint on the turn response", () => {
    const parsed = conversationTurnResponseSchema.parse({
      sessionId: "default",
      reply: "The Uber is $24.50. Should I book it?",
      kind: "proposal",
      activeRequest: { intent: "ride", status: "accepted" },
      clarificationsAsked: 0,
      pendingApproval: {
        tool: "book_ride",
        input: { optionId: "uber_wav_1" },
        reason: "confirmation_required",
        summary: "This action requires a confirmation token from a human.",
        timestamp: "2026-09-19T12:00:00.000Z",
        action: "book_ride",
        prompt: "The Uber is $24.50. Should I book it?",
        detail: "WAV · $24.50",
        estimate: "$24.50",
      },
    });
    expect(parsed.pendingApproval?.estimate).toBe("$24.50");
    expect(parsed.pendingApproval?.prompt).toContain("Should I book it?");
  });

  it("accepts a plan and a retry failure on the turn response", () => {
    const parsed = conversationTurnResponseSchema.parse({
      sessionId: "default",
      reply: "I couldn't get ride options just now. We can try again.",
      kind: "answer",
      activeRequest: { intent: "ride", status: "proposed" },
      clarificationsAsked: 0,
      plan: {
        steps: [
          {
            tool: "get_appointment",
            status: "ok",
            summary: "Dr. Chen tomorrow.",
            auditId: "aud_1",
          },
          {
            tool: "find_ride_options",
            status: "failed",
            summary: "Uber search failed.",
            auditId: "aud_2",
          },
        ],
      },
      failure: {
        kind: "retry",
        tool: "find_ride_options",
        summary: "Uber search failed.",
      },
    });
    expect(parsed.plan.steps).toHaveLength(2);
    expect(parsed.failure?.kind).toBe("retry");
  });

  it("requires reply text for Kasama's voice", () => {
    expect(speakRequestSchema.safeParse({ text: "Should I set that up?" }).success).toBe(true);
    expect(speakRequestSchema.safeParse({ text: "  " }).success).toBe(false);
  });

  it("does not show Uber option cards on a family email checkpoint", () => {
    const email = seniorThreadCards({
      live: true,
      intent: "ride",
      hasRideOptions: true,
      pendingTool: "notify_caretaker",
      bookingStatus: "booked",
    });
    expect(email.showRideOptions).toBe(false);
    expect(email.showFamilyMessage).toBe(true);

    const leftover = seniorThreadCards({
      live: true,
      intent: "unknown",
      hasRideOptions: true,
      pendingTool: "notify_caretaker",
      bookingStatus: "booked",
    });
    expect(leftover.showRideOptions).toBe(false);
    expect(leftover.showFamilyMessage).toBe(true);
  });

  it("still shows Uber option cards on an open ride thread", () => {
    const choosing = seniorThreadCards({
      live: true,
      intent: "ride",
      hasRideOptions: true,
      activeStatus: "proposed",
      bookingStatus: "booked",
    });
    expect(choosing.showRideOptions).toBe(true);
    expect(choosing.showFamilyMessage).toBe(false);
  });

  it("detects a chat line that lists UberX and WAV so the cards can stand alone", () => {
    expect(
      announcesRideOptions("I found two Uber options: UberX for $18.00 and WAV for $24.50. Which one would you like?"),
    ).toBe(true);
    expect(announcesRideOptions("I found 2 Uber options.")).toBe(true);
    expect(
      announcesRideOptions(
        "Your checkup with Dr. Chen is tomorrow at 10:30 AM. I can have an Uber pick you up at home around 10:15 AM so you arrive with time to spare. Should I set that up?",
      ),
    ).toBe(false);
    expect(announcesRideOptions("The Uber is $24.50. Should I book it?")).toBe(false);
    expect(
      announcesRideOptions("I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001."),
    ).toBe(false);
  });
});
