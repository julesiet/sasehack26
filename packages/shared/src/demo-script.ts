/**
 * Canonical 3-minute demo script (#12). Tests, rehearsal, and the printed
 * PDF all read this object so the spoken lines cannot drift.
 *
 * Designed loading / error / mic / handoff screens stay blocked:design.
 * This script reuses the existing senior states (thinking, error, micDenied)
 * and the typed fallback when speech-to-text is unavailable.
 */

export const DEMO_SCRIPT_ID = "issue-12";

/** Set to `1` in `apps/api/.env` so ChatGPT cannot change the spoken copy. */
export const KASAMA_DEMO_ENV = "KASAMA_DEMO";

export const DEMO_SCRIPT_TRANSCRIPTS = {
  rideRequest: "Please get me a ride to my doctor tomorrow.",
  chooseAccessible: "Choose the accessible one.",
  confirm: "Yes",
} as const;

export type DemoScriptBeatId =
  | "setup"
  | "intro"
  | "ride-request"
  | "choose-accessible"
  | "confirm"
  | "caretaker";

export type DemoScriptBeat = {
  id: DemoScriptBeatId;
  seconds: number;
  title: string;
  say?: string;
  tap?: string;
  expect?: string;
  pointAt?: string;
  fallback?: string;
};

export function isKasamaDemoEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const value = env[KASAMA_DEMO_ENV]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export function demoScriptBeats(): DemoScriptBeat[] {
  return [
    {
      id: "setup",
      seconds: 20,
      title: "Setup (before judges sit down)",
      expect:
        "API on port 3001. KASAMA_DEMO=1. Reset the iOS default session to live-demo so the ride is not already booked. Senior mode on the demo phone. Optional second phone already on Caretaker.",
      fallback:
        "If Expo cannot reach the API, stop. Do not improvise with a stale session.",
    },
    {
      id: "intro",
      seconds: 20,
      title: "Introduce Maria",
      pointAt:
        "Presenter: This is Maria. She has a checkup with Dr. Chen tomorrow at 10:30. Do not open Chat yet. Stay on Senior Home.",
    },
    {
      id: "ride-request",
      seconds: 40,
      title: "Ask for the ride",
      say: DEMO_SCRIPT_TRANSCRIPTS.rideRequest,
      expect:
        "Kasama names Dr. Chen, tomorrow, 10:30, and a pickup around 10:15. Two large Uber cards: UberX $18.00 and Wheelchair Uber $24.50. Screen may say Finding Ubers.",
      fallback:
        "Mic denied, STT missing, or a missed transcript: type the same line. Do not rephrase.",
    },
    {
      id: "choose-accessible",
      seconds: 25,
      title: "Choose the accessible Uber",
      say: DEMO_SCRIPT_TRANSCRIPTS.chooseAccessible,
      tap: "Wheelchair Uber card ($24.50)",
      expect: "The Uber is $24.50. Should I book it?",
      fallback: "Type: Choose the accessible one.",
    },
    {
      id: "confirm",
      seconds: 25,
      title: "Human yes - then book",
      say: DEMO_SCRIPT_TRANSCRIPTS.confirm,
      tap: "Confirm",
      expect:
        "Kasama books the wheelchair Uber for $24.50 and reads a confirmation id (UBER-WAV-0001 after a live-demo reset). Nothing is charged until this yes.",
      fallback: "Type Yes, or tap Confirm. If booking fails, tap Confirm again - do not pretend it booked.",
    },
    {
      id: "caretaker",
      seconds: 40,
      title: "Caretaker mode",
      tap: "Home Dev -> Caretaker (or the second iPhone already on Caretaker)",
      expect:
        "Appointment, wheelchair ride, timestamp, consent, CONFIRMED. Care notes: worth reviewing, 15-minute lead, no diagnosis.",
      pointAt:
        "Tap Care notes. Point at repeated questions or less sleep than usual. Say this is worth reviewing. Never a diagnosis.",
      fallback:
        "If the ride is still the seeded UBER-WAV-SEED booking, the session was not reset. Stop and reset to live-demo.",
    },
  ];
}

export function demoScriptFallbackLine(beatId: DemoScriptBeatId): string | null {
  const say = demoScriptBeats().find((beat) => beat.id === beatId)?.say;
  return say ?? null;
}
