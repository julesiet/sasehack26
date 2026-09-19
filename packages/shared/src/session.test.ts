import { describe, expect, it } from "vitest";
import {
  DEFAULT_SESSION_ID,
  resolveSessionId,
  sessionViewSchema,
} from "./session";

describe("session view contract", () => {
  it("uses a documented default session id", () => {
    expect(DEFAULT_SESSION_ID).toBe("default");
    expect(resolveSessionId()).toBe("default");
    expect(resolveSessionId("sess_1")).toBe("sess_1");
  });

  it("accepts a booking-style session projection", () => {
    const parsed = sessionViewSchema.parse({
      sessionId: "sess_1",
      currentRequest: {
        tool: "book_ride",
        input: { optionId: "uberx_1" },
        actor: "senior",
        timestamp: "2026-09-18T20:00:00.000Z",
      },
      pendingApproval: null,
      appointment: {
        id: "appt_maria_doctor_01",
        title: "Dr. Chen — annual checkup",
        start: "2026-09-19T17:30:00.000Z",
        location: "Springfield Family Medicine",
      },
      lastBooking: {
        provider: "uber",
        optionId: "uberx_1",
        status: "not_implemented",
        confirmationId: "stub_uber_uberx_1",
        summary: "Uber booking stub.",
        timestamp: "2026-09-18T20:00:00.000Z",
        consentGranted: true,
      },
      caretakerActivity: [],
      careSignal: {
        label: "worth reviewing",
        note: "Repeated-confusion markers are worth reviewing.",
        source: "maria_seed",
        flaggedConfusionCount: 2,
      },
      consentGranted: true,
      events: [],
    });

    expect(parsed.lastBooking?.provider).toBe("uber");
    expect(parsed.careSignal?.label).toBe("worth reviewing");
  });
});
