import { describe, expect, it } from "vitest";
import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { FAMILY_EMAIL_RECIPIENT, resolveFamilyRecipient } from "./family";
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
