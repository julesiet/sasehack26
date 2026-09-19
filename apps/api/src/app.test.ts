import { beforeEach, describe, expect, it } from "vitest";
import { app } from "./app";
import { auditLog } from "./audit-log";

beforeEach(() => {
  auditLog.clear();
});

describe("POST /tools/:name", () => {
  it("denies book_ride without approval and writes the audit log", async () => {
    const res = await app.request("/tools/book_ride", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { optionId: "uberx_1" },
        actor: "model",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.denied).toBe(true);
    expect(body.reason).toBe("confirmation_required");

    const events = auditLog.list();
    expect(events).toHaveLength(1);
    expect(events[0]?.proposed.tool).toBe("book_ride");
    expect(events[0]?.approved?.allowed).toBe(false);
    expect(events[0]?.executed?.attempted).toBe(false);
    expect(events[0]?.outcome.denied).toBe(true);
  });

  it("denies notify_caretaker send without approval and returns a preview draft", async () => {
    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "model",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.denied).toBe(true);
    expect(body.preview).toBe(true);
    expect(body.sent).toBe(false);
    expect(body.draft).toEqual({
      summary: "Maria is running late.",
      urgency: "high",
    });
  });

  it("allows get_appointment without approval and records the outcome", async () => {
    const res = await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: "2026-09-19" },
        actor: "model",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.summary).toBeTruthy();
    expect(auditLog.list()[0]?.executed?.attempted).toBe(true);
  });

  it("returns Maria's seeded appointment for tomorrow and null for other dates", async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().slice(0, 10);

    const res = await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: dateStr },
        actor: "model",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.appointment?.location).toContain("Springfield Family Medicine");

    const other = await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: "2020-01-01" },
        actor: "model",
      }),
    });
    const otherBody = await other.json();
    expect(otherBody.appointment).toBeNull();
  });

  it("executes book_ride only when a human approval token is present", async () => {
    const res = await app.request("/tools/book_ride", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { optionId: "uberx_1" },
        actor: "senior",
        approvalToken: "tok_yes",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.booking?.provider).toBe("uber");
    expect(auditLog.list()[0]?.approved?.allowed).toBe(true);
    expect(auditLog.list()[0]?.executed?.attempted).toBe(true);
  });

  it("does not let the model self-approve a booking even with a token", async () => {
    const res = await app.request("/tools/book_ride", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { optionId: "uberx_1" },
        actor: "model",
        approvalToken: "tok_yes",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe("model_cannot_self_approve");
    expect(auditLog.list()[0]?.executed?.attempted).toBe(false);
  });

  it("rejects unknown tools", async () => {
    const res = await app.request("/tools/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input: {}, actor: "model" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /audit", () => {
  it("returns appended events", async () => {
    await app.request("/tools/find_ride_options", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: {
          pickup: "Home",
          destination: "Clinic",
          arriveBy: "2026-09-19T14:00:00",
        },
        actor: "model",
      }),
    });

    const res = await app.request("/audit");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.proposed.tool).toBe("find_ride_options");
  });
});
