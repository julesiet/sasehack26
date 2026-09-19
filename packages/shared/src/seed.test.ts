import { describe, expect, it } from "vitest";
import {
  MARIA_CARETAKER_PREFERENCES,
  MARIA_NEARBY_HOSPITAL,
  MARIA_PROFILE,
  computeArrivalTarget,
  getMariaAppointment,
  getMariaPriorRequests,
  getMariaSeedBundle,
  getMariaWearableReadings,
} from "./seed";

const REFERENCE = new Date("2026-09-18T08:00:00");

describe("MARIA_PROFILE", () => {
  it("captures communication preferences and accessibility needs", () => {
    expect(MARIA_PROFILE.name).toBe("Maria Alvarez");
    expect(MARIA_PROFILE.communicationPreferences.speaksSlowly).toBe(true);
    expect(MARIA_PROFILE.accessibilityNeeds.length).toBeGreaterThan(0);
  });
});

describe("getMariaAppointment", () => {
  it("is tomorrow at 10:30 relative to the reference date, with pickup and destination", () => {
    const appointment = getMariaAppointment(REFERENCE);
    const start = new Date(appointment.start);

    expect(start.getDate()).toBe(REFERENCE.getDate() + 1);
    expect(start.getHours()).toBe(10);
    expect(start.getMinutes()).toBe(30);
    expect(appointment.pickup).toBeTruthy();
    expect(appointment.destination).toBeTruthy();
  });
});

describe("computeArrivalTarget", () => {
  it("is 15 minutes before the appointment start by default", () => {
    const appointment = getMariaAppointment(REFERENCE);
    const target = new Date(computeArrivalTarget(appointment));
    const start = new Date(appointment.start);

    expect(target.getHours()).toBe(10);
    expect(target.getMinutes()).toBe(15);
    expect(start.getTime() - target.getTime()).toBe(15 * 60 * 1000);
  });

  it("honors a custom lead time", () => {
    const appointment = getMariaAppointment(REFERENCE);
    const target = new Date(computeArrivalTarget(appointment, 30));
    expect(target.getMinutes()).toBe(0);
    expect(target.getHours()).toBe(10);
  });
});

describe("MARIA_CARETAKER_PREFERENCES", () => {
  it("has escalation rules covering missed confirmation and repeated confusion", () => {
    const conditions = MARIA_CARETAKER_PREFERENCES.escalationRules.map((r) => r.id);
    expect(conditions).toContain("escalation_missed_confirmation");
    expect(conditions).toContain("escalation_repeated_confusion");
  });
});

describe("getMariaWearableReadings", () => {
  it("returns 7 days of sleep/activity readings ending at the reference date", () => {
    const readings = getMariaWearableReadings(REFERENCE);
    expect(readings).toHaveLength(7);
    expect(readings[readings.length - 1]?.date).toBe(
      REFERENCE.toISOString().slice(0, 10),
    );
    for (const reading of readings) {
      expect(reading.sleepHours).toBeGreaterThan(0);
      expect(reading.steps).toBeGreaterThan(0);
    }
  });
});

describe("getMariaPriorRequests", () => {
  it("includes at least one repeated-confusion marker for the care-signal insight", () => {
    const requests = getMariaPriorRequests(REFERENCE);
    expect(requests.some((r) => r.flaggedConfusion)).toBe(true);
  });
});

describe("getMariaSeedBundle", () => {
  it("bundles every fixture so caretaker and care-signal consumers can read one object", () => {
    const bundle = getMariaSeedBundle(REFERENCE);
    expect(bundle.profile).toEqual(MARIA_PROFILE);
    expect(bundle.appointment.id).toBe("appt_maria_doctor_01");
    expect(bundle.arrivalTarget).toBeTruthy();
    expect(bundle.caretakerPreferences.caretakerId).toBe("caretaker_james");
    expect(bundle.wearableReadings).toHaveLength(7);
    expect(bundle.priorRequests.length).toBeGreaterThan(0);
  });
});

describe("MARIA_NEARBY_HOSPITAL", () => {
  it("is St. Mary's Hospital from the senior chat mock", () => {
    expect(MARIA_NEARBY_HOSPITAL.placeName).toBe("St. Mary's Hospital");
    expect(MARIA_NEARBY_HOSPITAL.distance).toBe("0.8 miles away");
  });
});
