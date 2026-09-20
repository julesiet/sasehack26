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

  it("can drop events for one session without clearing the rest", () => {
    const log = createAuditLog();
    log.append({
      whoAsked: { actor: "model", sessionId: "keep" },
      proposed: { tool: "get_appointment", input: {} },
      approved: { allowed: true, approvalTokenPresent: false },
      executed: { tool: "get_appointment", attempted: true },
      outcome: { success: true, summary: "ok" },
    });
    log.append({
      whoAsked: { actor: "senior", sessionId: "drop" },
      proposed: { tool: "book_ride", input: {} },
      approved: { allowed: true, by: "senior", approvalTokenPresent: true },
      executed: { tool: "book_ride", attempted: true },
      outcome: { success: true, summary: "ok" },
    });

    log.clearSession("drop");

    expect(log.list().map((event) => event.whoAsked.sessionId)).toEqual(["keep"]);
  });
});
