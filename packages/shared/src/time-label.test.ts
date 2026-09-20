import { describe, expect, it } from "vitest";
import {
  formatHospitalTimeLabel,
  formatIsoTimeLabel,
  formatPickupWhen,
  replaceIsoTimeLabels,
} from "./time-label";

describe("hospital time labels", () => {
  it("formats an ISO stamp as weekday and clock", () => {
    expect(formatIsoTimeLabel("2026-09-20T10:00:00.000Z")).toBe("Sunday at 10:00 AM");
    expect(formatHospitalTimeLabel("2026-09-20T14:30:00-04:00")).toBe("Sunday at 2:30 PM");
  });

  it("leaves an already-speakable label alone", () => {
    expect(formatHospitalTimeLabel("Thursday at 10:00 AM")).toBe("Thursday at 10:00 AM");
  });

  it("replaces an ISO stamp inside a Tasks detail line", () => {
    expect(
      replaceIsoTimeLabels("Annual physical. · 2026-09-20T10:00:00.000Z"),
    ).toBe("Annual physical. · Sunday at 10:00 AM");
  });
});

describe("ride pickup labels", () => {
  it("says today or tomorrow from the pickup datetime, not a hardcoded day", () => {
    const now = new Date(2026, 8, 20, 9, 0, 0);
    const today = new Date(2026, 8, 20, 15, 0, 0);
    const tomorrow = new Date(2026, 8, 21, 10, 15, 0);
    expect(formatPickupWhen(today.toISOString(), now)).toBe("Today at 3:00 PM");
    expect(formatPickupWhen(tomorrow.toISOString(), now)).toBe("Tomorrow at 10:15 AM");
  });
});
