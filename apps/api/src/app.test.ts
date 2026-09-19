import { beforeEach, describe, expect, it } from "vitest";
import { sessionViewSchema } from "@kasama/shared";
import { app } from "./app";
import { auditLog } from "./audit-log";
import { sessionStore } from "./session-store";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
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

  it("can filter events by sessionId while still returning all events without a query", async () => {
    await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: "2020-01-01" },
        actor: "model",
        sessionId: "alpha",
      }),
    });
    await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: "2020-01-02" },
        actor: "model",
        sessionId: "beta",
      }),
    });

    const all = await (await app.request("/audit")).json();
    expect(all.events).toHaveLength(2);

    const filtered = await (await app.request("/audit?sessionId=alpha")).json();
    expect(filtered.events).toHaveLength(1);
    expect(filtered.events[0]?.whoAsked.sessionId).toBe("alpha");
  });
});

describe("GET /sessions/:sessionId", () => {
  const tomorrow = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  async function postTool(
    name: string,
    body: Record<string, unknown>,
  ): Promise<Response> {
    return app.request(`/tools/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns an empty session view that clients can poll before any tools run", async () => {
    const res = await app.request("/sessions/sess_empty");
    expect(res.status).toBe(200);
    const body = sessionViewSchema.parse(await res.json());
    expect(body.sessionId).toBe("sess_empty");
    expect(body.currentRequest).toBeNull();
    expect(body.pendingApproval).toBeNull();
    expect(body.appointment).toBeNull();
    expect(body.lastBooking).toBeNull();
    expect(body.caretakerActivity).toEqual([]);
    expect(body.consentGranted).toBe(false);
    expect(body.events).toEqual([]);
    expect(body.careSignal?.label).toBe("worth reviewing");
  });

  it("uses the documented default session when sessionId is omitted", async () => {
    await postTool("get_appointment", {
      input: { date: "2020-01-01" },
      actor: "model",
    });

    const res = await app.request("/sessions/default");
    expect(res.status).toBe(200);
    const body = sessionViewSchema.parse(await res.json());
    expect(body.sessionId).toBe("default");
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.whoAsked.sessionId).toBe("default");
    expect(body.currentRequest?.tool).toBe("get_appointment");
  });

  it("projects appointment, ride, timestamp, and consent after a booking-style flow", async () => {
    await postTool("get_appointment", {
      input: { date: tomorrow },
      actor: "model",
      sessionId: "booking-1",
    });
    await postTool("find_ride_options", {
      input: {
        pickup: "412 Willow Lane, Springfield",
        destination: "Springfield Family Medicine",
        arriveBy: `${tomorrow}T14:00:00`,
      },
      actor: "model",
      sessionId: "booking-1",
    });
    await postTool("book_ride", {
      input: { optionId: "uberx_1" },
      actor: "senior",
      approvalToken: "tok_yes",
      sessionId: "booking-1",
      consentGranted: true,
    });

    const res = await app.request("/sessions/booking-1");
    expect(res.status).toBe(200);
    const body = sessionViewSchema.parse(await res.json());
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.lastBooking?.provider).toBe("uber");
    expect(body.lastBooking?.optionId).toBe("uberx_1");
    expect(body.lastBooking?.timestamp).toBeTruthy();
    expect(body.lastBooking?.consentGranted).toBe(true);
    expect(body.consentGranted).toBe(true);
    expect(body.pendingApproval).toBeNull();
    expect(body.currentRequest?.tool).toBe("book_ride");
  });

  it("lets senior and caretaker clients share the same sessionId", async () => {
    await postTool("book_ride", {
      input: { optionId: "uberx_1" },
      actor: "senior",
      approvalToken: "tok_yes",
      sessionId: "shared-family",
      consentGranted: true,
    });
    await postTool("notify_caretaker", {
      input: { summary: "Maria's Uber is booked.", urgency: "low" },
      actor: "caretaker",
      approvalToken: "tok_caretaker",
      sessionId: "shared-family",
    });

    const seniorView = sessionViewSchema.parse(
      await (await app.request("/sessions/shared-family")).json(),
    );
    const caretakerView = sessionViewSchema.parse(
      await (await app.request("/sessions/shared-family")).json(),
    );

    expect(seniorView).toEqual(caretakerView);
    expect(seniorView.lastBooking?.optionId).toBe("uberx_1");
    expect(seniorView.caretakerActivity).toHaveLength(1);
    expect(seniorView.caretakerActivity[0]?.sent).toBe(true);
    expect(seniorView.events.map((event) => event.whoAsked.actor)).toEqual([
      "senior",
      "caretaker",
    ]);
  });

  it("keeps session events ordered and stable across polls", async () => {
    await postTool("get_appointment", {
      input: { date: tomorrow },
      actor: "model",
      sessionId: "ordered-1",
    });
    await postTool("find_ride_options", {
      input: {
        pickup: "Home",
        destination: "Clinic",
        arriveBy: `${tomorrow}T14:00:00`,
      },
      actor: "model",
      sessionId: "ordered-1",
    });
    await postTool("book_ride", {
      input: { optionId: "uberx_1" },
      actor: "model",
      sessionId: "ordered-1",
    });
    await postTool("book_ride", {
      input: { optionId: "uberx_1" },
      actor: "senior",
      approvalToken: "tok_yes",
      sessionId: "ordered-1",
    });

    const first = sessionViewSchema.parse(
      await (await app.request("/sessions/ordered-1")).json(),
    );
    const second = sessionViewSchema.parse(
      await (await app.request("/sessions/ordered-1")).json(),
    );

    expect(first.events.map((event) => event.id)).toEqual([
      "evt_1",
      "evt_2",
      "evt_3",
      "evt_4",
    ]);
    expect(first.events.map((event) => event.id)).toEqual(
      second.events.map((event) => event.id),
    );
    expect(first.pendingApproval).toBeNull();
    const timestamps = first.events.map((event) => event.timestamp);
    expect(timestamps).toEqual([...timestamps].sort());
  });

  it("records pending approval when booking is denied", async () => {
    await postTool("book_ride", {
      input: { optionId: "uberx_1" },
      actor: "model",
      sessionId: "pending-1",
    });

    const body = sessionViewSchema.parse(
      await (await app.request("/sessions/pending-1")).json(),
    );
    expect(body.pendingApproval?.tool).toBe("book_ride");
    expect(body.pendingApproval?.reason).toBe("confirmation_required");
    expect(body.lastBooking).toBeNull();
  });
});
