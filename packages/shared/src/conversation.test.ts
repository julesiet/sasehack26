import { describe, expect, it } from "vitest";
import {
  MAX_CLARIFICATIONS_PER_REQUEST,
  conversationTurnRequestSchema,
  conversationTurnResponseSchema,
  emptyConversationState,
  speakRequestSchema,
} from "./conversation";

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

  it("starts with no turns, no active request, and an empty plan", () => {
    expect(emptyConversationState()).toEqual({
      turns: [],
      activeRequest: null,
      clarificationsAsked: 0,
      plan: { steps: [] },
      failure: null,
    });
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
});
