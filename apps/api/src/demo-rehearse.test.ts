import { beforeEach, describe, expect, it } from "vitest";
import {
  DEMO_SCRIPT_TRANSCRIPTS,
  buildCaretakerDashboard,
  sessionViewSchema,
} from "@kasama/shared";
import { app } from "./app";
import { auditLog } from "./audit-log";
import { runDemoRehearsal } from "./demo-rehearse";
import { sessionStore } from "./session-store";
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
  process.env.KASAMA_DEMO = "";
});

describe("POST /sessions/:sessionId/reset", () => {
  it("restores the unbooked live-demo preset for the 3-minute script", async () => {
    await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: DEMO_SCRIPT_TRANSCRIPTS.rideRequest,
        sessionId: "default",
      }),
    });
    expect(sessionStore.get("default").lastRideOptions.length).toBeGreaterThan(0);

    const res = await app.request("/sessions/default/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ preset: "live-demo" }),
    });

    expect(res.status).toBe(200);
    const view = sessionViewSchema.parse(await res.json());
    expect(view.sessionId).toBe("default");
    expect(view.lastBooking).toBeNull();
    expect(view.lastApproval).toBeNull();
    expect(view.lastRideOptions).toEqual([]);
    expect(view.consentGranted).toBe(false);
    expect(view.conversation.chats.map((chat) => chat.title)).toEqual([
      "Hospital visit",
      "Medication reminder",
    ]);
    expect(view.events).toEqual([]);
    expect(buildCaretakerDashboard({ view }).overviewStatus).toBe("idle");
  });
});

describe("runDemoRehearsal", () => {
  it("books the accessible Uber from the printed lines and shows caretaker CONFIRMED", async () => {
    const result = await runDemoRehearsal({ sessionId: "issue-12-rehearse" });

    expect(result.ok).toBe(true);
    expect(result.beats.map((beat) => beat.id)).toEqual([
      "ride-request",
      "choose-accessible",
      "confirm",
    ]);
    expect(result.beats.every((beat) => beat.ok)).toBe(true);
    expect(result.beats[0]?.reply).toContain("Dr. Chen");
    expect(result.beats[0]?.reply).toMatch(/Should I set that up\?$/);
    expect(result.beats[1]?.reply).toBe("The Uber is $24.50. Should I book it?");
    expect(result.beats[2]?.reply).toContain("wheelchair Uber");
    expect(result.beats[2]?.reply).toContain("UBER-WAV-0001");
    expect(result.dashboard.overviewStatus).toBe("confirmed");
    expect(result.dashboard.overviewBadge).toBe("CONFIRMED");
    expect(result.dashboard.ride?.confirmationId).toBe("UBER-WAV-0001");
    expect(result.dashboard.careNotes).toMatch(/worth reviewing/i);
  });
});
