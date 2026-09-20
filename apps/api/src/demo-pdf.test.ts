import { describe, expect, it } from "vitest";
import { DEMO_SCRIPT_TRANSCRIPTS } from "@kasama/shared";
import { renderDemoScriptPdf } from "./demo-pdf";

describe("renderDemoScriptPdf", () => {
  it("prints the exact spoken lines for the 3-minute demo", () => {
    const pdf = renderDemoScriptPdf().toString("latin1");
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain(DEMO_SCRIPT_TRANSCRIPTS.rideRequest);
    expect(pdf).toContain(DEMO_SCRIPT_TRANSCRIPTS.chooseAccessible);
    expect(pdf).toContain("The Uber is $24.50. Should I book it?");
    expect(pdf).toContain("KASAMA_DEMO=1");
    expect(pdf).toContain("worth reviewing");
    expect(pdf).toContain("%%EOF");
    expect(Buffer.from(pdf, "latin1").includes(Buffer.from("\u2014"))).toBe(false);
  });
});
