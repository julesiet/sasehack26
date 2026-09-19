import { describe, expect, it } from "vitest";
import {
  approvedBookingReply,
  failedBookingReply,
  bookingApprovalPrompt,
  describePendingApproval,
  pendingRideOptionId,
  rideProductTitle,
  selectedRideOption,
  spokenRideChoice,
  pendingMedicationReminder,
  pendingHospitalVisit,
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

  it("reads a WAV booking back with the confirmation id", () => {
    expect(
      approvedBookingReply({
        estimate: DEMO_UBER_WAV_ESTIMATE,
        product: "WAV",
        confirmationId: "UBER-WAV-0001",
      }),
    ).toBe("I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.");
  });

  it("reads an UberX booking back with the confirmation id", () => {
    expect(
      approvedBookingReply({
        estimate: "$18.00",
        product: "UberX",
        confirmationId: "UBER-UBERX-0001",
      }),
    ).toBe("I booked the UberX for $18.00. Your confirmation is UBER-UBERX-0001.");
  });

  it("does not claim a booking when verification failed", () => {
    expect(failedBookingReply()).toBe(
      "I couldn't confirm that Uber booking. Nothing was charged. We can try again.",
    );
  });

  it("picks the pending Uber option for the ride cards", () => {
    const options = [
      { optionId: "uberx_1", provider: "uber" as const, product: "UberX" as const, estimate: "$18.00", accessible: false },
      { optionId: "uber_wav_1", provider: "uber" as const, product: "WAV" as const, estimate: "$24.50", accessible: true },
    ];
    expect(pendingRideOptionId({ tool: "book_ride", input: { optionId: "uberx_1" } })).toBe("uberx_1");
    expect(selectedRideOption(options, { tool: "book_ride", input: { optionId: "uberx_1" } })?.product).toBe("UberX");
    expect(selectedRideOption(options, null, "WAV")?.optionId).toBe("uber_wav_1");
    expect(rideProductTitle("WAV")).toBe("Wheelchair Uber");
    expect(spokenRideChoice("UberX")).toBe("the UberX");
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

  it("describes a medication reminder checkpoint", () => {
    const described = describePendingApproval({
      tool: "save_medication_reminder",
      toolInput: { name: "Lisinopril", frequency: "Every 4 days", intervalDays: 4 },
    });
    expect(described.action).toBe("save_medication_reminder");
    expect(described.prompt).toContain("Lisinopril");
    expect(described.prompt).toContain("tasks");
  });

  it("describes a hospital visit checkpoint", () => {
    const described = describePendingApproval({
      tool: "save_hospital_visit",
      toolInput: {
        placeName: "St. Mary's Hospital",
        distance: "0.8 miles away",
        reason: "Annual physical. Discuss blood pressure.",
        timeLabel: "Thursday at 10:00 AM",
      },
    });
    expect(described.action).toBe("save_hospital_visit");
    expect(described.prompt).toContain("St. Mary's Hospital");
  });

  it("reads reminder and hospital details from pending input", () => {
    expect(
      pendingMedicationReminder({
        tool: "save_medication_reminder",
        input: { name: "Lisinopril", frequency: "Every 4 days", intervalDays: 4 },
      })?.name,
    ).toBe("Lisinopril");
    expect(
      pendingHospitalVisit({
        tool: "save_hospital_visit",
        input: {
          placeName: "St. Mary's Hospital",
          distance: "0.8 miles away",
          reason: "Annual physical.",
          timeLabel: "Thursday at 10:00 AM",
        },
      })?.placeName,
    ).toBe("St. Mary's Hospital");
  });
});
