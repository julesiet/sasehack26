import { describe, expect, it } from "vitest";
import {
  MAX_PLAYGROUND_ADVANCE_TURNS,
  PLAYGROUND_DEFAULT_SESSION_ID,
  PLAYGROUND_DEMO_TRANSCRIPT,
  playgroundRequestSchema,
  playgroundResponseSchema,
} from "./playground";

describe("playground contract", () => {
  it("defaults actor to senior and until to checkpoint", () => {
    const parsed = playgroundRequestSchema.parse({
      transcript: `  ${PLAYGROUND_DEMO_TRANSCRIPT}  `,
    });
    expect(parsed.transcript).toBe(PLAYGROUND_DEMO_TRANSCRIPT);
    expect(parsed.actor).toBe("senior");
    expect(parsed.until).toBe("checkpoint");
  });

  it("rejects an empty transcript", () => {
    expect(playgroundRequestSchema.safeParse({ transcript: "   " }).success).toBe(false);
  });

  it("uses an isolated default session id", () => {
    expect(PLAYGROUND_DEFAULT_SESSION_ID).toBe("playground");
    expect(MAX_PLAYGROUND_ADVANCE_TURNS).toBe(2);
  });

  it("accepts a demo response with appointment, rides, and a pending approval", () => {
    const parsed = playgroundResponseSchema.parse({
      sessionId: "playground",
      reply: "The Uber is $24.50. Should I book it?",
      kind: "proposal",
      activeRequest: { intent: "ride", status: "accepted", appointmentId: "appt_maria_doctor_01" },
      clarificationsAsked: 0,
      plan: {
        steps: [
          { tool: "get_appointment", status: "ok", summary: "Dr. Chen tomorrow." },
          { tool: "find_ride_options", status: "ok", summary: "Two Ubers." },
          { tool: "book_ride", status: "denied", summary: "Needs a human yes." },
        ],
      },
      failure: null,
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
      appointment: {
        id: "appt_maria_doctor_01",
        title: "Dr. Chen — annual checkup",
        start: "2026-09-20T14:30:00.000Z",
        location: "Springfield Family Medicine",
      },
      rideOptions: [
        {
          optionId: "uberx_1",
          provider: "uber",
          product: "UberX",
          estimate: "$18.00",
          accessible: false,
        },
        {
          optionId: "uber_wav_1",
          provider: "uber",
          product: "WAV",
          estimate: "$24.50",
          accessible: true,
        },
      ],
      lastBooking: null,
      lastApproval: null,
      events: [],
      seed: { profileId: "senior_maria", name: "Maria Alvarez" },
      until: "checkpoint",
      acceptedPlan: true,
    });
    expect(parsed.pendingApproval?.estimate).toBe("$24.50");
    expect(parsed.rideOptions).toHaveLength(2);
    expect(parsed.lastBooking).toBeNull();
  });

  it("accepts a retry failure payload", () => {
    const parsed = playgroundResponseSchema.parse({
      sessionId: "playground",
      reply: "I couldn't look that up.",
      kind: "answer",
      activeRequest: null,
      clarificationsAsked: 0,
      failure: { kind: "retry", tool: "get_appointment", summary: "Lookup failed." },
      appointment: null,
      events: [],
      seed: { profileId: "senior_maria", name: "Maria Alvarez" },
      until: "turn",
    });
    expect(parsed.failure?.kind).toBe("retry");
    expect(parsed.pendingApproval).toBeNull();
  });
});
