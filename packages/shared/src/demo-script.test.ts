import { describe, expect, it } from "vitest";
import {
  DEMO_SCRIPT_ID,
  DEMO_SCRIPT_TRANSCRIPTS,
  KASAMA_DEMO_ENV,
  demoScriptBeats,
  demoScriptFallbackLine,
  isKasamaDemoEnabled,
} from "./demo-script";

describe("3-minute demo script", () => {
  it("uses the issue #12 ride line and accessible choice", () => {
    expect(DEMO_SCRIPT_ID).toBe("issue-12");
    expect(DEMO_SCRIPT_TRANSCRIPTS.rideRequest).toBe(
      "Please get me a ride to my doctor tomorrow.",
    );
    expect(DEMO_SCRIPT_TRANSCRIPTS.chooseAccessible).toBe("Choose the accessible one.");
    expect(DEMO_SCRIPT_TRANSCRIPTS.confirm).toBe("Yes");
    expect(KASAMA_DEMO_ENV).toBe("KASAMA_DEMO");
    expect(isKasamaDemoEnabled({ KASAMA_DEMO: "1" })).toBe(true);
    expect(isKasamaDemoEnabled({ KASAMA_DEMO: "" })).toBe(false);
  });

  it("covers intro, ride, accessible choice, confirm, and caretaker in under 3 minutes", () => {
    const beats = demoScriptBeats();
    const ids = beats.map((beat) => beat.id);
    expect(ids).toEqual([
      "setup",
      "intro",
      "ride-request",
      "choose-accessible",
      "confirm",
      "caretaker",
    ]);
    const spoken = beats.filter((beat) => beat.say);
    expect(spoken).toHaveLength(3);
    const budget = beats.reduce((sum, beat) => sum + beat.seconds, 0);
    expect(budget).toBeLessThanOrEqual(180);
    expect(budget).toBeGreaterThan(90);
  });

  it("tells the presenter to type the same line if the mic fails", () => {
    expect(demoScriptFallbackLine("ride-request")).toBe(
      "Please get me a ride to my doctor tomorrow.",
    );
    expect(demoScriptFallbackLine("choose-accessible")).toBe("Choose the accessible one.");
    expect(demoScriptFallbackLine("confirm")).toBe("Yes");
    expect(demoScriptFallbackLine("intro")).toBeNull();
  });

  it("never uses diagnosis language", () => {
    const copy = demoScriptBeats()
      .flatMap((beat) => [beat.title, beat.say, beat.expect, beat.pointAt, beat.fallback])
      .filter((part): part is string => Boolean(part))
      .join(" ");
    expect(copy).not.toMatch(/\b(diagnos(?:e|ed)|prescription|etiology)\b/i);
    expect(copy).toMatch(/worth reviewing/i);
    expect(copy).toMatch(/no diagnosis/i);
  });
});
