import { describe, expect, it } from "vitest";
import { buildCaretakerDashboard } from "./caretaker-dashboard";
import {
  MARIA_DEMO_CONFIRMATION_ID,
  getMariaDemoRideOptions,
  getMariaDemoSession,
  getMariaLiveDemoSession,
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
    expect(demo.conversation.activeChatId).toBe("chat_ride");
    expect(demo.conversation.chats.map((chat) => chat.title)).toEqual([
      "Hospital visit",
      "Medication reminder",
      "Doctor ride",
    ]);
    expect(demo.lastMedicationReminder).toMatchObject({
      name: "Lisinopril",
      status: "saved",
    });
    expect(demo.lastHospitalVisit).toMatchObject({
      placeName: "St. Mary's Hospital",
      status: "saved",
    });
    expect(demo.tasks.map((task) => task.title)).toEqual([
      "Lisinopril",
      "St. Mary's Hospital",
    ]);
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
      lastMedicationReminder: demo.lastMedicationReminder,
      lastHospitalVisit: demo.lastHospitalVisit,
      tasks: demo.tasks,
      caretakerActivity: demo.caretakerActivity,
      caretakerNarrative: [],
      careSignal: {
        label: "worth reviewing",
        note: seed.priorRequests.find((request) => request.flaggedConfusion)?.note ?? "",
        source: "maria_seed",
        flaggedConfusionCount: 3,
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
      "Maria scheduled a hospital visit",
      "Kasama saved appointment details",
      "Thank you.",
      "Maria set a reminder",
      "Kasama saved a reminder",
      "Thanks.",
      "Maria requested a ride",
      "Kasama confirmed booking",
      'Most recent response: "Thanks Kasama, that helps a lot. I\'ll be ready by 2:00."',
    ]);
    expect(demo.conversation).not.toEqual(emptyConversationState());
  });
});

describe("getMariaLiveDemoSession", () => {
  it("keeps Maria's appointment and history but leaves the ride unbooked", () => {
    const live = getMariaLiveDemoSession(NOW);
    const seed = getMariaSeedBundle(NOW);

    expect(live.appointment.id).toBe(seed.appointment.id);
    expect(live.lastBooking).toBeNull();
    expect(live.lastApproval).toBeNull();
    expect(live.lastRideOptions).toEqual([]);
    expect(live.consentGranted).toBe(false);
    expect(live.caretakerActivity).toEqual([]);
    expect(live.conversation.activeChatId).toBeNull();
    expect(live.conversation.turns).toEqual([]);
    expect(live.conversation.chats.map((chat) => chat.title)).toEqual([
      "Hospital visit",
      "Medication reminder",
    ]);
    expect(live.tasks.map((task) => task.title)).toEqual([
      "Lisinopril",
      "St. Mary's Hospital",
    ]);

    const view: SessionView = {
      sessionId: "default",
      currentRequest: null,
      pendingApproval: null,
      lastApproval: live.lastApproval,
      lastRideOptions: live.lastRideOptions,
      appointment: live.appointment,
      lastBooking: live.lastBooking,
      lastMedicationReminder: live.lastMedicationReminder,
      lastHospitalVisit: live.lastHospitalVisit,
      tasks: live.tasks,
      caretakerActivity: live.caretakerActivity,
      caretakerNarrative: [],
      careSignal: {
        label: "worth reviewing",
        note: seed.priorRequests.find((request) => request.flaggedConfusion)?.note ?? "",
        source: "maria_seed",
        flaggedConfusionCount: 3,
      },
      consentGranted: live.consentGranted,
      conversation: live.conversation,
      events: [],
    };

    const dashboard = buildCaretakerDashboard({ view, seed, now: NOW });
    expect(dashboard.overviewStatus).toBe("idle");
    expect(dashboard.ride).toBeNull();
    expect(dashboard.careNotes).toMatch(/worth reviewing/i);
    expect(dashboard.careNotes).toMatch(/15 minutes/i);
    expect(dashboard.careNotes).toMatch(/No diagnosis noted/i);
  });
});
