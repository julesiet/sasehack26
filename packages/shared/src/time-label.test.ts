import { describe, expect, it } from "vitest";
import { formatHospitalTimeLabel, formatIsoTimeLabel, replaceIsoTimeLabels } from "./time-label";

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
