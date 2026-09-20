import { describe, expect, it } from "vitest";
import {
  buildCareNotes,
  buildCaretakerDashboard,
  caretakerRideTitle,
  formatAppointmentWhen,
  formatDashboardDate,
} from "./caretaker-dashboard";
import { emptyConversationState } from "./conversation";
import { getMariaSeedBundle } from "./seed";
import type { SessionView } from "./session";

const NOW = new Date("2026-09-18T08:00:00");
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
    careSignal: {
      label: "worth reviewing",
      note: "Asked the same question twice within 5 minutes.",
      source: "maria_seed",
      flaggedConfusionCount: 2,
    },
    consentGranted: false,
    conversation: emptyConversationState(),
    events: [],
    ...partial,
  };
}

describe("caretaker dashboard projection", () => {
  it("uses seed appointment, Margaret, and family contacts before any tools run", () => {
    const dashboard = buildCaretakerDashboard({ view: view(), seed: SEED, now: NOW });

    expect(dashboard.viewerFirstName).toBe("Margaret");
    expect(dashboard.seniorFirstName).toBe("Maria");
    expect(dashboard.subtitle).toBe("Here's your current update on Maria.");
    expect(dashboard.dateLabel).toBe(formatDashboardDate(NOW));
    expect(dashboard.appointment.title).toBe(SEED.appointment.title);
    expect(dashboard.appointment.location).toBe(SEED.appointment.destination);
    expect(dashboard.appointment.whenLabel).toBe(
      formatAppointmentWhen(SEED.appointment.start, NOW),
    );
    expect(dashboard.contacts.map((contact) => contact.name)).toEqual([
      "Sarah",
      "James Alvarez",
      "Emily",
      "Jules",
    ]);
    expect(dashboard.overviewStatus).toBe("idle");
    expect(dashboard.overviewBadge).toBeNull();
    expect(dashboard.ride).toBeNull();
  });

  it("keeps care notes as context, never a diagnosis", () => {
    const notes = buildCareNotes({
      seed: SEED,
      careNote: "Asked the same question twice within 5 minutes.",
    });
    expect(notes).toMatch(/worth reviewing/i);
    expect(notes).toMatch(/15 minutes early/);
    expect(notes).toMatch(/No diagnosis noted/);
    expect(notes.toLowerCase()).not.toMatch(/diagnosed|anxiety disorder|depression/);
  });

  it("replaces a diagnostic care-signal note with worth-reviewing language", () => {
    const notes = buildCareNotes({
      seed: SEED,
      careNote: "Possible anxiety diagnosis from wearable data.",
    });
    expect(notes).toBe(
      "Recent activity is worth reviewing. Suggest leaving 15 minutes early for her appointment. No diagnosis noted — only comfort preferences shared.",
    );
  });

  it("shows a waiting ride after Maria is asked to confirm", () => {
    const dashboard = buildCaretakerDashboard({
      now: NOW,
      seed: SEED,
      view: view({
        pendingApproval: {
          tool: "book_ride",
          action: "book_ride",
          input: { optionId: "uber_wav_1" },
          reason: "confirmation_required",
          summary: "Needs a human yes.",
          timestamp: "2026-09-18T13:45:00.000Z",
          prompt: "The Uber is $24.50. Should I book it?",
          status: "pending",
        },
        lastRideOptions: [
          {
            optionId: "uber_wav_1",
            provider: "uber",
            product: "WAV",
            estimate: "$24.50",
            etaMinutes: 12,
            accessible: true,
          },
        ],
      }),
    });

    expect(dashboard.overviewStatus).toBe("pending");
    expect(dashboard.overviewBadge).toBe("WAITING");
    expect(dashboard.ride?.title).toBe(caretakerRideTitle("WAV"));
    expect(dashboard.ride?.booked).toBe(false);
    expect(dashboard.ride?.pickup).toBe(SEED.appointment.pickup);
    expect(dashboard.consentItems[0]).toMatchObject({
      id: "ride_booking",
      tone: "pending",
      title: "Ride booking waiting",
    });
  });

  it("shows a confirmed booking a judge can explain without refreshing", () => {
    const dashboard = buildCaretakerDashboard({
      now: NOW,
      seed: SEED,
      view: view({
        appointment: {
          id: SEED.appointment.id,
          title: SEED.appointment.title,
          start: SEED.appointment.start,
          location: SEED.appointment.destination,
        },
        lastBooking: {
          provider: "uber",
          optionId: "uber_wav_1",
          status: "booked",
          confirmationId: "UBER-WAV-0001",
          summary: "Uber WAV booked.",
          timestamp: "2026-09-18T13:50:00.000Z",
          consentGranted: true,
        },
        lastApproval: {
          tool: "book_ride",
          action: "book_ride",
          decision: "approved",
          actor: "senior",
          timestamp: "2026-09-18T13:50:00.000Z",
          summary: "Booked.",
        },
        lastRideOptions: [
          {
            optionId: "uber_wav_1",
            provider: "uber",
            product: "WAV",
            estimate: "$24.50",
            etaMinutes: 12,
            accessible: true,
          },
        ],
        consentGranted: true,
        conversation: {
          ...emptyConversationState(),
          turns: [
            {
              id: "turn_1",
              timestamp: "2026-09-18T13:42:00.000Z",
              speaker: "senior",
              text: "Please get me a ride to my doctor tomorrow.",
            },
            {
              id: "turn_2",
              timestamp: "2026-09-18T13:47:00.000Z",
              speaker: "kasama",
              text: "I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.",
              kind: "answer",
            },
            {
              id: "turn_3",
              timestamp: "2026-09-18T14:05:00.000Z",
              speaker: "senior",
              text: "Thanks Kasama, that helps a lot. I'll be ready by 2:00.",
            },
          ],
        },
      }),
    });

    expect(dashboard.overviewStatus).toBe("confirmed");
    expect(dashboard.overviewBadge).toBe("CONFIRMED");
    expect(dashboard.ride).toMatchObject({
      title: "Wheelchair Accessible Van",
      booked: true,
      confirmationId: "UBER-WAV-0001",
    });
    expect(dashboard.consentItems[0]).toMatchObject({
      tone: "approved",
      title: "Ride booking approved",
    });
    expect(dashboard.activity.map((item) => item.title)).toEqual([
      "Maria requested a ride",
      "Kasama confirmed booking",
      'Most recent response: "Thanks Kasama, that helps a lot. I\'ll be ready by 2:00."',
    ]);
  });

  it("keeps a declined booking honest", () => {
    const dashboard = buildCaretakerDashboard({
      now: NOW,
      seed: SEED,
      view: view({
        lastApproval: {
          tool: "book_ride",
          action: "book_ride",
          decision: "declined",
          actor: "senior",
          timestamp: "2026-09-18T13:50:00.000Z",
          summary: "Declined.",
        },
      }),
    });

    expect(dashboard.overviewStatus).toBe("declined");
    expect(dashboard.overviewBadge).toBe("DECLINED");
    expect(dashboard.consentItems[0]).toMatchObject({
      tone: "neutral",
      title: "Ride booking declined",
    });
  });

  it("projects a draft FAMILY UPDATE for a notify preview", () => {
    const dashboard = buildCaretakerDashboard({
      view: view({
        pendingApproval: {
          tool: "notify_caretaker",
          action: "notify_caretaker",
          reason: "confirmation_required",
          summary: "This action requires a confirmation token from a human.",
          prompt: "I can send this to your family. Should I send it?",
          detail: "Preview only — not sent yet.",
          preview: "Maria missed her medication reminder.",
          input: {
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            recipientName: "James Alvarez",
          },
          timestamp: NOW.toISOString(),
          status: "pending",
        },
        caretakerActivity: [
          {
            id: "act_1",
            timestamp: NOW.toISOString(),
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            sent: false,
            preview: true,
            recipientName: "James Alvarez",
          },
        ],
      }),
      seed: SEED,
      now: NOW,
    });
    expect(dashboard.familyUpdate).toEqual({
      status: "draft",
      kicker: "FAMILY UPDATE",
      headline: "Draft — awaiting confirmation",
      summary: "Maria missed her medication reminder.",
      urgencyLabel: "Normal",
      recipientName: "James Alvarez",
      sentLine: null,
      whenLabel: null,
    });
  });

  it("projects sent and cancelled FAMILY UPDATE copy", () => {
    const sent = buildCaretakerDashboard({
      view: view({
        caretakerActivity: [
          {
            id: "act_sent",
            timestamp: NOW.toISOString(),
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            sent: true,
            preview: false,
            recipientName: "James Alvarez",
          },
        ],
      }),
      seed: SEED,
      now: NOW,
    });
    expect(sent.familyUpdate).toMatchObject({
      status: "sent",
      kicker: "FAMILY UPDATE",
      headline: "Sent",
      summary: "Maria missed her medication reminder.",
      urgencyLabel: "Normal",
      recipientName: "James Alvarez",
      sentLine: "Sent to James Alvarez",
      whenLabel: formatAppointmentWhen(NOW.toISOString(), NOW),
    });

    const cancelled = buildCaretakerDashboard({
      view: view({
        lastApproval: {
          tool: "notify_caretaker",
          action: "notify_caretaker",
          decision: "declined",
          actor: "senior",
          timestamp: NOW.toISOString(),
          summary: "Okay. I will not send that message.",
          prompt: "I can send this to your family. Should I send it?",
        },
      }),
      seed: SEED,
      now: NOW,
    });
    expect(cancelled.familyUpdate).toMatchObject({
      status: "not_sent",
      kicker: "FAMILY UPDATE",
      headline: "Not sent",
      summary: "Maria cancelled this message.",
    });
  });
});
