import { describe, expect, it } from "vitest";
import { emptyConversationState } from "./conversation";
import { evaluateEscalationRules } from "./escalation";
import { getMariaSeedBundle } from "./seed";
import type { SessionView } from "./session";

const NOW = new Date("2026-09-18T12:00:00");
const SEED = getMariaSeedBundle(NOW);

function view(partial: Partial<SessionView> = {}): SessionView {
  return {
    sessionId: "default",
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
    careSignal: null,
    consentGranted: false,
    conversation: emptyConversationState(),
    events: [],
    ...partial,
  };
}

describe("evaluateEscalationRules", () => {
  it("only drafts escalation_repeated_confusion when no ride or approval activity has happened yet", () => {
    const decisions = evaluateEscalationRules({ seed: SEED, view: view(), now: NOW });
    expect(decisions.map((d) => d.ruleId)).toEqual(["escalation_repeated_confusion"]);
  });

  it("drafts a low-urgency escalation_ride_booked notice once a ride is booked", () => {
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-SEED",
          summary: "Booked",
          timestamp: NOW.toISOString(),
          consentGranted: true,
        },
      }),
      now: NOW,
    });

    const rideBooked = decisions.find((d) => d.ruleId === "escalation_ride_booked");
    expect(rideBooked).toBeDefined();
    expect(rideBooked?.urgency).toBe("low");
    expect(rideBooked?.status).toBe("drafted");
    expect(rideBooked?.draft?.urgency).toBe("low");
    expect(rideBooked?.draft?.summary).toContain("UBER-WAV-SEED");
  });

  it("does not draft escalation_ride_booked when no ride has been booked", () => {
    const decisions = evaluateEscalationRules({ seed: SEED, view: view(), now: NOW });
    expect(decisions.some((d) => d.ruleId === "escalation_ride_booked")).toBe(false);
  });

  it("drafts a normal-urgency escalation_repeated_confusion notice from the seeded confusion markers", () => {
    const decisions = evaluateEscalationRules({ seed: SEED, view: view(), now: NOW });

    const repeated = decisions.find((d) => d.ruleId === "escalation_repeated_confusion");
    expect(repeated).toBeDefined();
    expect(repeated?.urgency).toBe("normal");
    expect(repeated?.status).toBe("drafted");
    expect(repeated?.draft?.urgency).toBe("normal");
  });

  it("does not draft escalation_repeated_confusion when confusion markers are spread across different days", () => {
    const spreadSeed = {
      ...SEED,
      priorRequests: SEED.priorRequests.map((request, index) => ({
        ...request,
        flaggedConfusion: request.flaggedConfusion,
        timestamp: request.flaggedConfusion
          ? new Date(new Date(request.timestamp).getTime() + index * 24 * 60 * 60 * 1000).toISOString()
          : request.timestamp,
      })),
    };

    const decisions = evaluateEscalationRules({ seed: spreadSeed, view: view(), now: NOW });
    expect(decisions.some((d) => d.ruleId === "escalation_repeated_confusion")).toBe(false);
  });

  it("drafts a high-urgency escalation_missed_confirmation notice once a ride approval has waited over 10 minutes", () => {
    const pendingSince = new Date(NOW.getTime() - 11 * 60 * 1000);
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        pendingApproval: {
          tool: "book_ride",
          input: { optionId: "uber_wav_1" },
          reason: "confirmation_required",
          summary: "Waiting on Maria",
          timestamp: pendingSince.toISOString(),
          status: "pending",
        },
      }),
      now: NOW,
    });

    const missed = decisions.find((d) => d.ruleId === "escalation_missed_confirmation");
    expect(missed).toBeDefined();
    expect(missed?.urgency).toBe("high");
    expect(missed?.status).toBe("drafted");
  });

  it("does not draft escalation_missed_confirmation before the 10-minute threshold", () => {
    const pendingSince = new Date(NOW.getTime() - 5 * 60 * 1000);
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        pendingApproval: {
          tool: "book_ride",
          input: { optionId: "uber_wav_1" },
          reason: "confirmation_required",
          summary: "Waiting on Maria",
          timestamp: pendingSince.toISOString(),
          status: "pending",
        },
      }),
      now: NOW,
    });

    expect(decisions.some((d) => d.ruleId === "escalation_missed_confirmation")).toBe(false);
  });

  it("does not draft escalation_missed_confirmation for a pending approval that isn't a ride", () => {
    const pendingSince = new Date(NOW.getTime() - 20 * 60 * 1000);
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        pendingApproval: {
          tool: "notify_caretaker",
          input: { summary: "x", urgency: "low" },
          reason: "confirmation_required",
          summary: "Waiting on Maria",
          timestamp: pendingSince.toISOString(),
          status: "pending",
        },
      }),
      now: NOW,
    });

    expect(decisions.some((d) => d.ruleId === "escalation_missed_confirmation")).toBe(false);
  });

  it("honors quiet hours (21:00-07:00) by deferring instead of drafting, and never sends", () => {
    const lateNight = new Date("2026-09-18T22:30:00");
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-SEED",
          summary: "Booked",
          timestamp: lateNight.toISOString(),
          consentGranted: true,
        },
      }),
      now: lateNight,
    });

    const rideBooked = decisions.find((d) => d.ruleId === "escalation_ride_booked");
    expect(rideBooked).toBeDefined();
    expect(rideBooked?.status).toBe("deferred");
    expect(rideBooked?.draft).toBeNull();
    expect(rideBooked?.reason).toMatch(/quiet hours/i);
  });

  it("honors quiet hours across midnight (e.g. 5am is still quiet)", () => {
    const earlyMorning = new Date("2026-09-18T05:00:00");
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-SEED",
          summary: "Booked",
          timestamp: earlyMorning.toISOString(),
          consentGranted: true,
        },
      }),
      now: earlyMorning,
    });

    const rideBooked = decisions.find((d) => d.ruleId === "escalation_ride_booked");
    expect(rideBooked?.status).toBe("deferred");
  });

  it("drafts normally just outside quiet hours (07:00 is no longer quiet)", () => {
    const morning = new Date("2026-09-18T07:00:00");
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-SEED",
          summary: "Booked",
          timestamp: morning.toISOString(),
          consentGranted: true,
        },
      }),
      now: morning,
    });

    const rideBooked = decisions.find((d) => d.ruleId === "escalation_ride_booked");
    expect(rideBooked?.status).toBe("drafted");
  });

  it("never returns a decision that looks sent", () => {
    const decisions = evaluateEscalationRules({
      seed: SEED,
      view: view({
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-SEED",
          summary: "Booked",
          timestamp: NOW.toISOString(),
          consentGranted: true,
        },
      }),
      now: NOW,
    });

    for (const decision of decisions) {
      expect(decision).not.toHaveProperty("sent");
      expect(["drafted", "deferred"]).toContain(decision.status);
    }
  });
});
