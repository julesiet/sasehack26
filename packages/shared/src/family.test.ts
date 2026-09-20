import { describe, expect, it } from "vitest";
import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import {
  FAMILY_EMAIL_RECIPIENT,
  familyMessageCardCopy,
  familyMessageFromApproval,
  resolveFamilyRecipient,
} from "./family";
import { familyEmailCopy } from "./family-report";
import { getMariaSeedBundle } from "./seed";

describe("family recipients", () => {
  it("lists Jules and James Alvarez as family members", () => {
    const names = getMariaSeedBundle().familyContacts.map((contact) => contact.name);
    expect(names).toContain("Jules");
    expect(names).toContain("James Alvarez");
  });

  it("resolves spoken James, Jules, Sarah, Emily, daughter, son, and family", () => {
    expect(resolveFamilyRecipient("james alvarez").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("jules").name).toBe("Jules");
    expect(resolveFamilyRecipient("sarah").name).toBe("Sarah");
    expect(resolveFamilyRecipient("emily").name).toBe("Emily");
    expect(resolveFamilyRecipient("daughter").name).toBe("Sarah");
    expect(resolveFamilyRecipient("son").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("family").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("").name).toBe("James Alvarez");
  });

  it("always delivers to Jules's Gmail even when the display name is James", () => {
    expect(FAMILY_EMAIL_RECIPIENT).toBe("juleselvandrade@gmail.com");
    expect(FAMILY_EMAIL_RECIPIENT).toBe(COMPOSIO_CARETAKER_RECIPIENT);
    expect(resolveFamilyRecipient("james alvarez").id).not.toBe("");
  });
});

describe("family message card copy", () => {
  it("builds the senior MESSAGE TO preview analysis", () => {
    const card = familyMessageCardCopy({
      recipientName: "James Alvarez",
      summary: "Maria missed her medication reminder.",
      urgency: "normal",
      status: "pending",
    });
    expect(card.eyebrow).toBe("MESSAGE TO");
    expect(card.recipientName).toBe("James Alvarez");
    expect(card.relationshipLabel).toBe("Son");
    expect(card.intro).toBe("Preview only.\nNothing is sent yet.");
    expect(card.summary).toBe("Maria missed her medication reminder.");
    expect(card.urgencyLabel).toBe("Normal");
    expect(card.healthShared).toBe(true);
    expect(card.healthLabel).toBe("Yes");
    expect(card.spokenPrompt).toContain("Preview only. Nothing is sent yet.");
    expect(card.spokenPrompt).toContain("James Alvarez, son");
    expect(card.spokenPrompt).toContain("Maria missed her medication reminder.");
    expect(card.spokenPrompt).toContain("Urgency is Normal");
    expect(card.spokenPrompt).toContain("Health information is included");
    expect(card.spokenPrompt).toContain("Should I send it?");
  });

  it("marks a non-health note as not sharing health information", () => {
    const card = familyMessageCardCopy({
      recipientName: "Jules",
      summary: "Maria asked me to say hello.",
      urgency: "low",
      status: "pending",
    });
    expect(card.relationshipLabel).toBe("Family");
    expect(card.healthShared).toBe(false);
    expect(card.healthLabel).toBe("No");
    expect(card.spokenPrompt).toContain("does not include health information");
  });

  it("keeps the draft recipient and summary on the just-resolved MESSAGE TO card", () => {
    const card = familyMessageFromApproval(null, {
      tool: "notify_caretaker",
      decision: "approved",
      preview: "Maria missed her medication reminder.",
      recipientName: "Jules",
      urgency: "normal",
    });
    expect(card?.recipientName).toBe("Jules");
    expect(card?.summary).toBe("Maria missed her medication reminder.");
    expect(card?.status).toBe("sent");
    expect(card?.relationshipLabel).toBe("Family");
    expect(card?.intro).toBe("Sent.");
  });

  it("does not default James when the confirmed draft was Sarah", () => {
    const card = familyMessageFromApproval(null, {
      tool: "notify_caretaker",
      decision: "approved",
      preview: "Maria missed her medication reminder.",
      recipientName: "Sarah",
      urgency: "normal",
    });
    expect(card?.recipientName).toBe("Sarah");
    expect(card?.summary).toBe("Maria missed her medication reminder.");
    expect(card?.relationshipLabel).toBe("Daughter");
    expect(card?.intro).toBe("Sent.");
  });

  it("shows Not sent after cancel", () => {
    const card = familyMessageFromApproval(null, {
      tool: "notify_caretaker",
      decision: "declined",
      preview: "Maria missed her medication reminder.",
      recipientName: "James Alvarez",
      urgency: "normal",
    });
    expect(card?.status).toBe("cancelled");
    expect(card?.intro).toBe("Not sent.");
    expect(card?.recipientName).toBe("James Alvarez");
    expect(card?.relationshipLabel).toBe("Son");
  });
});

describe("family email copy", () => {
  const NOW = new Date("2026-09-19T08:00:00");

  it("sends Jules a formatted report from Maria's seeded care data", () => {
    const email = familyEmailCopy({
      recipientName: "James Alvarez",
      summary: "Maria missed her medication reminder.",
      urgency: "normal",
      now: NOW,
    });
    expect(email.subject).toBe("Kasama family report for Jules — Maria, Normal urgency");
    expect(email.isHtml).toBe(true);
    expect(email.body).toContain("<h1");
    expect(email.body).toContain("<h2");
    expect(email.body).toContain("<table");
    expect(email.body).toContain("<th");
    expect(email.body).toContain("Hi Jules");
    expect(email.body).toContain("This note");
    expect(email.body).toContain("James Alvarez");
    expect(email.body).toContain("Son");
    expect(email.body).toContain("Urgency");
    expect(email.body).toContain("Normal");
    expect(email.body).toContain("Health information");
    expect(email.body).toContain("Yes");
    expect(email.body).toContain("Maria missed her medication reminder.");
    expect(email.body).toContain("Dr. Chen — annual checkup");
    expect(email.body).toContain("412 Willow Lane, Springfield");
    expect(email.body).toContain("Springfield Family Medicine");
    expect(email.body).toContain("Lisinopril");
    expect(email.body).toContain("Every 4 days");
    expect(email.body).toContain("St. Mary's Hospital");
    expect(email.body).toContain("Thursday at 10:00 AM");
    expect(email.body).toContain("UBER-WAV-SEED");
    expect(email.body).toContain("Sleep");
    expect(email.body).toContain("Steps");
    expect(email.body).toMatch(/worth reviewing/i);
    expect(email.body).toMatch(/not a diagnosis/i);
    expect(email.body).toContain("juleselvandrade@gmail.com");
    expect(email.body).toContain("uses a walker");
  });

  it("still includes the seeded report when the note is not health information", () => {
    const email = familyEmailCopy({
      recipientName: "Jules",
      summary: "Maria asked me to say hello.",
      urgency: "low",
      now: NOW,
    });
    expect(email.subject).toBe("Kasama family report for Jules — Maria, Low urgency");
    expect(email.body).toContain("Hi Jules");
    expect(email.body).toContain("<table");
    expect(email.body).toContain("Jules");
    expect(email.body).toContain("Family");
    expect(email.body).toContain("Health information");
    expect(email.body).toContain("No");
    expect(email.body).toContain("Maria asked me to say hello.");
    expect(email.body).toContain("Dr. Chen — annual checkup");
  });
});

