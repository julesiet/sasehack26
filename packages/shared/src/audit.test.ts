import { describe, expect, it } from "vitest";
import { createAuditLog } from "./audit";

describe("createAuditLog", () => {
  it("appends a tool-call event with who/proposed/approved/executed/outcome", () => {
    const log = createAuditLog();
    const event = log.append({
      whoAsked: { actor: "model", sessionId: "sess_1" },
      proposed: { tool: "book_ride", input: { optionId: "uberx_1" } },
      approved: { allowed: false, approvalTokenPresent: false },
      executed: { tool: "book_ride", attempted: false },
      outcome: {
        success: false,
        denied: true,
        reason: "confirmation_required",
        summary: "Uber booking needs confirmation.",
      },
    });

    expect(event.id).toMatch(/^evt_/);
    expect(event.timestamp).toBeTruthy();
    expect(log.list()).toEqual([event]);
    expect(event.whoAsked.actor).toBe("model");
    expect(event.proposed.tool).toBe("book_ride");
    expect(event.approved?.allowed).toBe(false);
    expect(event.executed?.attempted).toBe(false);
    expect(event.outcome.denied).toBe(true);
  });
});
