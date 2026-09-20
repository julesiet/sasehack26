import { describe, expect, it } from "vitest";
import { emptyConversationState } from "./conversation";
import { generateCaretakerNarrative } from "./narrative";
import type { SessionView } from "./session";
import type { AuditEvent } from "./audit";

const TS = "2026-09-19T10:00:00.000Z";
const TS_RIDE = "2026-09-19T10:01:00.000Z";
const TS_WAIT = "2026-09-19T10:02:00.000Z";
const TS_DECIDE = "2026-09-19T10:03:00.000Z";

const WAV = {
  optionId: "uber_wav_1",
  provider: "uber" as const,
  product: "WAV" as const,
  estimate: "$24.50",
  etaMinutes: 12,
  accessible: true,
};

const UBERX = {
  optionId: "uberx_1",
  provider: "uber" as const,
  product: "UberX" as const,
  estimate: "$18.00",
  etaMinutes: 8,
  accessible: false,
};

function event(partial: Partial<AuditEvent> & Pick<AuditEvent, "id" | "proposed">): AuditEvent {
  return {
    timestamp: TS,
    whoAsked: { actor: "model", sessionId: "narr-1" },
    approved: { allowed: true, by: "model", approvalTokenPresent: false },
    executed: { tool: partial.proposed.tool, attempted: true },
    outcome: { success: true, summary: "ok" },
    ...partial,
  };
}

function view(partial: Partial<SessionView> = {}): SessionView {
  return {
    sessionId: "narr-1",
    currentRequest: null,
    pendingApproval: null,
    lastApproval: null,
    lastRideOptions: [],
    appointment: null,
    lastBooking: null,
    lastMedicationReminder: null,
    lastHospitalVisit: null,
    tasks: [],
    caretakerActivity: [],
    caretakerNarrative: [],
    careSignal: null,
    consentGranted: false,
    conversation: emptyConversationState(),
    events: [],
    ...partial,
  };
}

/** Happy-path tool sequence: appointment → Uber options → $24.50 checkpoint, not booked. */
function happyPathFixture(): SessionView {
  return view({
    appointment: {
      id: "appt_maria_doctor_01",
      title: "Dr. Chen — annual checkup",
      start: "2026-09-20T17:30:00.000Z",
      location: "Springfield Family Medicine",
    },
    lastRideOptions: [UBERX, WAV],
    pendingApproval: {
      tool: "book_ride",
      action: "book_ride",
      input: { optionId: "uber_wav_1" },
      reason: "confirmation_required",
      summary: "Needs a human yes.",
      timestamp: TS_WAIT,
      prompt: "The Uber is $24.50. Should I book it?",
      estimate: "$24.50",
      status: "pending",
    },
    lastBooking: null,
    conversation: {
      ...emptyConversationState(),
      turns: [
        {
          id: "turn_1",
          timestamp: TS,
          speaker: "senior",
          text: "Please get me a ride to my doctor tomorrow.",
        },
      ],
    },
    events: [
      event({
        id: "evt_1",
        proposed: { tool: "get_appointment", input: { date: "2026-09-20" } },
        outcome: { success: true, summary: "Found Dr. Chen at Springfield Family Medicine" },
      }),
      event({
        id: "evt_2",
        timestamp: TS_RIDE,
        proposed: {
          tool: "find_ride_options",
          input: { pickup: "Home", destination: "Clinic", arriveBy: TS_RIDE },
        },
        outcome: { success: true, summary: "Found UberX and WAV" },
      }),
      event({
        id: "evt_3",
        timestamp: TS_WAIT,
        whoAsked: { actor: "model", sessionId: "narr-1" },
        proposed: { tool: "book_ride", input: { optionId: "uber_wav_1" } },
        approved: { allowed: false, approvalTokenPresent: false },
        executed: { tool: "book_ride", attempted: false },
        outcome: {
          success: false,
          denied: true,
          reason: "confirmation_required",
          summary: "Needs a human yes.",
        },
      }),
    ],
  });
}

describe("generateCaretakerNarrative", () => {
  it("returns an empty list when the session has no activity", () => {
    expect(generateCaretakerNarrative(view())).toEqual([]);
  });

  it("mentions the appointment, Uber WAV $24.50, and that nothing is booked until a human yes", () => {
    const narrative = generateCaretakerNarrative(happyPathFixture());
    const text = narrative.map((item) => item.text).join(" ");

    expect(narrative.length).toBeGreaterThan(0);
    expect(narrative.every((item) => item.timestamp)).toBe(true);
    expect(text).toMatch(/appointment/i);
    expect(text).toMatch(/WAV/i);
    expect(text).toMatch(/\$24\.50/);
    expect(text).toMatch(/human yes|nothing is booked/i);
    expect(text).not.toMatch(/booked\./i);
    expect(text.toLowerCase()).not.toMatch(/diagnos/);
  });

  it("says the Uber was not booked after a decline", () => {
    const narrative = generateCaretakerNarrative(
      view({
        ...happyPathFixture(),
        pendingApproval: null,
        lastApproval: {
          tool: "book_ride",
          action: "book_ride",
          decision: "declined",
          actor: "senior",
          timestamp: TS_DECIDE,
          summary: "Declined.",
        },
        lastBooking: null,
        events: [
          ...happyPathFixture().events,
          event({
            id: "evt_4",
            timestamp: TS_DECIDE,
            whoAsked: { actor: "senior", sessionId: "narr-1" },
            proposed: { tool: "book_ride", input: { optionId: "uber_wav_1" } },
            approved: { allowed: false, by: "senior", approvalTokenPresent: false },
            executed: { tool: "book_ride", attempted: false },
            outcome: {
              success: false,
              denied: true,
              reason: "declined_by_human",
              summary: "The Uber booking was declined. Nothing was booked.",
            },
          }),
        ],
      }),
    );
    const text = narrative.map((item) => item.text).join(" ");
    expect(text).toMatch(/not booked/i);
    expect(text.toLowerCase()).not.toMatch(/diagnos/);
  });

  it("never writes a medical conclusion", () => {
    const narrative = generateCaretakerNarrative(
      view({
        careSignal: {
          label: "worth reviewing",
          note: "Clinical diagnosis of anxiety from wearable data.",
          source: "maria_seed",
          flaggedConfusionCount: 2,
        },
        events: [
          event({
            id: "evt_1",
            proposed: { tool: "get_appointment", input: {} },
            outcome: { success: true, summary: "Clinical diagnosis: Flu" },
          }),
        ],
        appointment: {
          id: "appt_maria_doctor_01",
          title: "Dr. Chen — annual checkup",
          start: "2026-09-20T17:30:00.000Z",
          location: "Springfield Family Medicine",
        },
      }),
    );
    const text = narrative.map((item) => item.text).join(" ");
    expect(text.toLowerCase()).not.toMatch(/diagnosed|diagnosis of|clinical diagnosis/);
    expect(text).toMatch(/appointment/i);
  });
});
