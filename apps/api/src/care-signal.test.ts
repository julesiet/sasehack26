import { beforeEach, describe, expect, it } from "vitest";
import { auditLog } from "./audit-log";
import { invokeTool } from "./invoke-tool";
import { sessionStore } from "./session-store";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
});

describe("get_care_signal", () => {
  it("returns the Maria sleep + repeat-question signal from seed data, without diagnosing", async () => {
    const result = await invokeTool("get_care_signal", {
      actor: "caretaker",
      input: {},
    });

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      success: true,
      summary: "Maria asked about the same appointment twice and slept less than usual this week.",
      actions: ["remind", "notify_caretaker", "doctor_summary"],
      diagnosis: false,
    });
  });

  it("never requires approval — it is read-only", async () => {
    const result = await invokeTool("get_care_signal", {
      actor: "model",
      input: {},
    });

    expect(result.status).toBe(200);
    expect(result.body.success).toBe(true);
  });

  it("never includes diagnostic language in the summary", async () => {
    const result = await invokeTool("get_care_signal", {
      actor: "caretaker",
      input: {},
    });

    const summary = (result.body as { summary: string }).summary;
    expect(summary).not.toMatch(/diagnos/i);
  });
});
