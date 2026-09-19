import { describe, expect, it } from "vitest";
import { evaluateAction, evaluateToolCall } from "./policy";

const model = { actor: "model" as const };
const seniorApproved = {
  actor: "senior" as const,
  approvalToken: "tok_yes",
};

describe("evaluateAction", () => {
  it("allows read_calendar automatically", () => {
    expect(evaluateAction("read_calendar", model)).toMatchObject({
      allowed: true,
      requirement: "automatic",
    });
  });

  it("allows search_rides automatically", () => {
    expect(evaluateAction("search_rides", model)).toMatchObject({
      allowed: true,
      requirement: "automatic",
    });
  });

  it("allows draft_caretaker_message as a preview without approval", () => {
    expect(evaluateAction("draft_caretaker_message", model)).toMatchObject({
      allowed: true,
      requirement: "automatic_preview",
      preview: true,
    });
  });

  it("denies send_message without approval", () => {
    const decision = evaluateAction("send_message", model);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("confirmation_required");
  });

  it("denies book_ride without approval", () => {
    const decision = evaluateAction("book_ride", model);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("confirmation_required");
  });

  it("denies spend_money without approval", () => {
    const decision = evaluateAction("spend_money", model);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("confirmation_required");
  });

  it("denies model self-approval for book_ride even with a token", () => {
    const decision = evaluateAction("book_ride", {
      actor: "model",
      approvalToken: "tok_yes",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("model_cannot_self_approve");
  });

  it("denies model self-approval for spend_money even with a token", () => {
    const decision = evaluateAction("spend_money", {
      actor: "model",
      approvalToken: "tok_yes",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("model_cannot_self_approve");
  });

  it("allows book_ride when a senior provides an approval token", () => {
    expect(evaluateAction("book_ride", seniorApproved)).toMatchObject({
      allowed: true,
      requirement: "require_confirmation",
    });
  });

  it("denies change_medication for the model", () => {
    const decision = evaluateAction("change_medication", {
      actor: "model",
      approvalToken: "tok_yes",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("caretaker_doctor_only");
  });

  it("allows change_medication for a caretaker with an approval token", () => {
    expect(
      evaluateAction("change_medication", {
        actor: "caretaker",
        approvalToken: "tok_med",
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies share_health_information without consent", () => {
    const decision = evaluateAction("share_health_information", {
      actor: "senior",
      recipient: "daughter@example.com",
      allowedRecipients: ["daughter@example.com"],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("consent_required");
  });

  it("denies share_health_information when the recipient is not allowed", () => {
    const decision = evaluateAction("share_health_information", {
      actor: "senior",
      consentGranted: true,
      recipient: "stranger@example.com",
      allowedRecipients: ["daughter@example.com"],
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("recipient_not_allowed");
  });

  it("allows share_health_information with consent and an allowed recipient", () => {
    expect(
      evaluateAction("share_health_information", {
        actor: "senior",
        consentGranted: true,
        recipient: "daughter@example.com",
        allowedRecipients: ["daughter@example.com"],
      }),
    ).toMatchObject({ allowed: true });
  });

  it("denies diagnose for every actor", () => {
    expect(evaluateAction("diagnose", seniorApproved).allowed).toBe(false);
    expect(evaluateAction("diagnose", { actor: "doctor" }).allowed).toBe(false);
    expect(evaluateAction("diagnose", model).reason).toBe(
      "diagnose_not_allowed",
    );
  });
});

describe("evaluateToolCall", () => {
  it("allows get_appointment and find_ride_options without approval", () => {
    expect(evaluateToolCall("get_appointment", model).allowed).toBe(true);
    expect(evaluateToolCall("find_ride_options", model).allowed).toBe(true);
  });

  it("does not allow book_ride to skip confirmation", () => {
    const decision = evaluateToolCall("book_ride", model);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("confirmation_required");
  });

  it("drafts notify_caretaker automatically when send confirmation is missing", () => {
    const decision = evaluateToolCall("notify_caretaker", model);
    expect(decision.allowed).toBe(true);
    expect(decision.preview).toBe(true);
    expect(decision.action).toBe("draft_caretaker_message");
    expect(evaluateAction("send_message", model).reason).toBe("confirmation_required");
  });

  it("sends notify_caretaker only with a human approval token", () => {
    const decision = evaluateToolCall("notify_caretaker", seniorApproved);
    expect(decision.allowed).toBe(true);
    expect(decision.preview).toBeUndefined();
    expect(decision.action).toBe("send_message");
  });

  it("rejects a model self-approved notify_caretaker send", () => {
    const decision = evaluateToolCall("notify_caretaker", {
      actor: "model",
      approvalToken: "tok_yes",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("model_cannot_self_approve");
  });

  it("treats book_ride as spending money, so it cannot skip that check", () => {
    const decision = evaluateToolCall("book_ride", seniorApproved);
    expect(decision.allowed).toBe(true);
    expect(evaluateToolCall("book_ride", model).allowed).toBe(false);
  });
});
