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

  it("starts with no turns and no active request", () => {
    expect(emptyConversationState()).toEqual({
      turns: [],
      activeRequest: null,
      clarificationsAsked: 0,
    });
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
  });

  it("requires reply text for Kasama's voice", () => {
    expect(speakRequestSchema.safeParse({ text: "Should I set that up?" }).success).toBe(true);
    expect(speakRequestSchema.safeParse({ text: "  " }).success).toBe(false);
  });
});
