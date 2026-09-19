import { describe, expect, it } from "vitest";
import { buildCaretakerDashboard } from "./caretaker-dashboard";
import {
  MARIA_DEMO_CONFIRMATION_ID,
  getMariaDemoRideOptions,
  getMariaDemoSession,
} from "./demo-session";
import { getMariaDemoConversationTurns, getMariaSeedBundle } from "./seed";
import { emptyConversationState } from "./conversation";
import type { SessionView } from "./session";

const NOW = new Date("2026-09-18T10:00:00");

describe("getMariaDemoSession", () => {
  it("matches the senior ride thread the caretaker dashboard already narrates", () => {
    const demo = getMariaDemoSession(NOW);
    const seed = getMariaSeedBundle(NOW);

    expect(demo.conversation.turns).toEqual(getMariaDemoConversationTurns(NOW));
    expect(demo.conversation.turns.map((turn) => turn.speaker)).toEqual([
      "senior",
      "kasama",
      "senior",
    ]);
    expect(demo.conversation.turns[0]?.text).toBe(
      "Please get me a ride to my doctor tomorrow.",
    );
    expect(demo.appointment.id).toBe(seed.appointment.id);
    expect(demo.lastRideOptions).toEqual(getMariaDemoRideOptions());
    expect(demo.lastBooking).toMatchObject({
      optionId: "uber_wav_1",
      status: "booked",
      confirmationId: MARIA_DEMO_CONFIRMATION_ID,
    });
    expect(demo.lastApproval?.decision).toBe("approved");
    expect(demo.consentGranted).toBe(true);

    const view: SessionView = {
      sessionId: "default",
      currentRequest: null,
      pendingApproval: null,
      lastApproval: demo.lastApproval,
      lastRideOptions: demo.lastRideOptions,
      appointment: demo.appointment,
      lastBooking: demo.lastBooking,
      caretakerActivity: demo.caretakerActivity,
      careSignal: {
        label: "worth reviewing",
        note: seed.priorRequests.find((request) => request.flaggedConfusion)?.note ?? "",
        source: "maria_seed",
        flaggedConfusionCount: 2,
      },
      consentGranted: demo.consentGranted,
      conversation: demo.conversation,
      events: [],
    };

    const dashboard = buildCaretakerDashboard({ view, seed, now: NOW });
    expect(dashboard.overviewStatus).toBe("confirmed");
    expect(dashboard.ride?.title).toBe("Wheelchair Accessible Van");
    expect(dashboard.ride?.confirmationId).toBe(MARIA_DEMO_CONFIRMATION_ID);
    expect(dashboard.activity.map((item) => item.title)).toEqual([
      "Maria requested a ride",
      "Kasama confirmed booking",
      'Most recent response: "Thanks Kasama, that helps a lot. I\'ll be ready by 2:00."',
    ]);
    expect(demo.conversation).not.toEqual(emptyConversationState());
  });
});
