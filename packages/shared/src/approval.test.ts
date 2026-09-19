import { describe, expect, it } from "vitest";
import {
  bookingApprovalPrompt,
  describePendingApproval,
  DEMO_UBER_WAV_ESTIMATE,
} from "./approval";

describe("approval prompts", () => {
  it("asks to book the demo WAV price", () => {
    expect(bookingApprovalPrompt()).toBe("The Uber is $24.50. Should I book it?");
  });

  it("fills booking display fields from the ride option", () => {
    const described = describePendingApproval({
      tool: "book_ride",
      toolInput: { optionId: "uber_wav_1" },
      rideOptions: [
        { optionId: "uber_wav_1", product: "WAV", estimate: DEMO_UBER_WAV_ESTIMATE, accessible: true },
      ],
    });
    expect(described.action).toBe("book_ride");
    expect(described.estimate).toBe("$24.50");
    expect(described.prompt).toContain("Should I book it?");
  });

  it("marks a caretaker draft as preview only", () => {
    const described = describePendingApproval({
      tool: "notify_caretaker",
      toolInput: { summary: "Maria is going to her doctor's appointment.", urgency: "normal" },
    });
    expect(described.action).toBe("notify_caretaker");
    expect(described.preview).toContain("doctor");
    expect(described.detail).toContain("Preview only");
  });
});
