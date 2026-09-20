import { describe, expect, it } from "vitest";
import {
  looksLikeHospitalSchedule,
  looksLikeMedicationReminder,
  formatSpeakableTimeLabel,
  parseAppointmentTime,
  parseMedicationReminder,
  spokenDateTime,
  tidyAppointmentReason,
} from "./care-intent";

describe("care intent", () => {
  it("parses the Lisinopril demo line", () => {
    const spoken = "remind me to take lisinopril every 4 days";
    expect(looksLikeMedicationReminder(spoken)).toBe(true);
    expect(parseMedicationReminder(spoken)).toEqual({
      name: "Lisinopril",
      frequency: "Every 4 days",
      intervalDays: 4,
    });
  });

  it("formats Thursday at 10 AM like the hospital card", () => {
    expect(parseAppointmentTime("thursday at 10 am")).toBe("Thursday at 10:00 AM");
  });

  it("resolves a spoken ride clock onto today when that time is still ahead", () => {
    const now = new Date(2026, 8, 20, 9, 0, 0);
    const when = spokenDateTime("get me a ride at 3 pm", now);
    expect(when).toBeDefined();
    expect(when?.getFullYear()).toBe(2026);
    expect(when?.getMonth()).toBe(8);
    expect(when?.getDate()).toBe(20);
    expect(when?.getHours()).toBe(15);
    expect(when?.getMinutes()).toBe(0);
  });

  it("formats ISO timestamps as weekday and clock", () => {
    expect(parseAppointmentTime("2026-09-20T10:00:00.000Z")).toBe("Sunday at 10:00 AM");
    expect(formatSpeakableTimeLabel("2026-09-20T14:30:00-04:00")).toBe("Sunday at 2:30 PM");
  });

  it("tidies the annual physical reason", () => {
    expect(tidyAppointmentReason("Annual physical. I want to discuss my blood pressure")).toBe(
      "Annual physical. Discuss blood pressure.",
    );
  });

  it("treats hospital scheduling as not a ride", () => {
    expect(
      looksLikeHospitalSchedule("schedule an appointment at a hospital near me", false),
    ).toBe(true);
    expect(looksLikeHospitalSchedule("get me a ride to the hospital", true)).toBe(false);
  });

  it("starts from ordinary reminder phrasing", () => {
    expect(looksLikeMedicationReminder("set a reminder")).toBe(true);
    expect(looksLikeMedicationReminder("can you set reminders")).toBe(true);
    expect(looksLikeMedicationReminder("remind me")).toBe(true);
    expect(looksLikeMedicationReminder("remind me about my appointment")).toBe(false);
  });

  it("starts from ordinary appointment-scheduling phrasing", () => {
    expect(looksLikeHospitalSchedule("schedule an appointment", false)).toBe(true);
    expect(looksLikeHospitalSchedule("i want to schedule an appointment", false)).toBe(true);
    expect(looksLikeHospitalSchedule("can you schedule appointments", false)).toBe(true);
    expect(looksLikeHospitalSchedule("what time is my appointment", false)).toBe(false);
  });
});
