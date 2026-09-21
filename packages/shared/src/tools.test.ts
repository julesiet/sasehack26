import { describe, expect, it } from "vitest";
import {
  medicationFrequencyLabel,
  saveMedicationReminderInputSchema,
  speakableMedicationFrequency,
} from "./tools";

describe("medication reminder frequency", () => {
  it("turns a day count into speakable Tasks copy", () => {
    expect(medicationFrequencyLabel(1)).toBe("Every day");
    expect(medicationFrequencyLabel(4)).toBe("Every 4 days");
  });

  it("does not leave a bare every on Tasks", () => {
    expect(speakableMedicationFrequency("every", 4)).toBe("Every 4 days");
    expect(speakableMedicationFrequency("Every", 1)).toBe("Every day");
    expect(saveMedicationReminderInputSchema.parse({
      name: "Lisinopril",
      frequency: "every",
      intervalDays: 4,
    })).toMatchObject({
      name: "Lisinopril",
      frequency: "Every 4 days",
      intervalDays: 4,
    });
  });

  it("keeps a richer cadence Maria actually said", () => {
    expect(speakableMedicationFrequency("twice a day", 1)).toBe("twice a day");
  });
});
