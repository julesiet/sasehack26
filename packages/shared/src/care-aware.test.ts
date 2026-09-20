import { describe, expect, it } from "vitest";
import {
  buildCareAwareView,
  buildRepeatedQuestionsNote,
  buildWorthReviewingQuote,
  formatCareAwareDateTime,
  formatSeconds,
  responseTone,
} from "./care-aware";
import { getMariaSeedBundle } from "./seed";

const NOW = new Date("2026-09-18T15:45:00");
const SEED = getMariaSeedBundle(NOW);

describe("buildCareAwareView", () => {
  it("projects Maria's seeded usage, repeats, and worth-reviewing quote", () => {
    const view = buildCareAwareView({ seed: SEED, now: NOW });

    expect(view.seniorFirstName).toBe("Maria");
    expect(view.dateTimeLabel).toBe(formatCareAwareDateTime(NOW));
    expect(view.totalUsageMinutes).toBe(12);
    expect(view.periods.map((period) => [period.id, period.minutes])).toEqual([
      ["morning", 9],
      ["afternoon", 3],
      ["evening", 0],
    ]);
    expect(view.peakActivity).toMatch(/8:30am - 9:15am/);
    expect(view.repeatedQuestionsNote).toMatch(/doctor appointment 2 times on Tuesday morning/i);
    expect(view.repeatedQuestionsNote).toMatch(/daughter once on Thursday evening/i);
    expect(view.repeatedQuestionsNote).toMatch(/3 repeated questions/i);
    expect(view.worthReviewingQuote).toBe(
      "Maria asked about the same appointment twice and slept less than usual this week.",
    );
    expect(view.disclaimer).toMatch(/not a medical diagnosis/i);
    expect(view.worthReviewingQuote.toLowerCase()).not.toMatch(/diagnos|anxiety|depression/);
    expect(view.responseAverageSeconds).toBe(4.2);
    expect(view.responseDays.map((day) => day.weekday)).toEqual([
      "Mon",
      "Tue",
      "Wed",
      "Thu",
      "Fri",
      "Sat",
      "Sun",
    ]);
    expect(view.responseInsight).toMatch(/3\.1s/);
    expect(view.responseInsight).toMatch(/5\.8s/);
    expect(view.actions.map((action) => action.id)).toEqual([
      "remind",
      "notify_caretaker",
      "doctor_summary",
    ]);
  });

  it("keeps notify and remind copy from claiming a send or a diagnosis", () => {
    const view = buildCareAwareView({ seed: SEED, now: NOW });
    const notify = view.actions.find((action) => action.id === "notify_caretaker");
    const remind = view.actions.find((action) => action.id === "remind");
    expect(notify?.detail).toMatch(/not sent/i);
    expect(remind?.detail).toMatch(/did not change any medication/i);
  });
});

describe("formatCareAwareDateTime", () => {
  it("uses an ordinal day and compact am/pm time", () => {
    expect(formatCareAwareDateTime(NOW)).toBe("September 18th, 3:45pm");
    expect(formatCareAwareDateTime(new Date("2026-09-12T15:45:00"))).toBe(
      "September 12th, 3:45pm",
    );
  });
});

describe("responseTone", () => {
  it("marks slower days without calling them a medical concern", () => {
    expect(responseTone(2.8)).toBe("fast");
    expect(responseTone(5.1)).toBe("mid");
    expect(responseTone(6.2)).toBe("slow");
    expect(formatSeconds(4.2)).toBe("4.2s");
  });
});

describe("buildRepeatedQuestionsNote", () => {
  it("explains the week from flagged seed requests", () => {
    const note = buildRepeatedQuestionsNote(SEED.priorRequests, "Maria");
    expect(note).toMatch(/appointments and family check-ins/);
  });
});

describe("buildWorthReviewingQuote", () => {
  it("is explainable from sleep + repeated appointment asks", () => {
    const quote = buildWorthReviewingQuote(SEED, "Maria");
    expect(quote).toMatch(/appointment twice/i);
    expect(quote).toMatch(/slept less than usual/i);
    const avgSleep =
      SEED.wearableReadings.reduce((sum, reading) => sum + reading.sleepHours, 0) /
      SEED.wearableReadings.length;
    expect(avgSleep).toBeLessThan(7);
    expect(SEED.priorRequests.filter((request) => request.flaggedConfusion)).toHaveLength(3);
  });
});
