import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
  COMPOSIO_GMAIL_SEND_TOOL,
  PLAYGROUND_DEMO_TRANSCRIPT,
  buildCaretakerDashboard,
  approvedNotifyReply,
  conversationChatResponseSchema,
  conversationTurnResponseSchema,
  getMariaAppointment,
  playgroundResponseSchema,
  sessionViewSchema,
  emptyConversationState,
} from "@kasama/shared";
import { app, createApp } from "./app";
import { auditLog } from "./audit-log";
import { ComposioNotConfiguredError, type KasamaComposio } from "./composio";
import { sessionStore } from "./session-store";
import { SttNotConfiguredError, TtsNotConfiguredError } from "./speech";
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
});

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const mariaAppointmentDay = localDateString(new Date(getMariaAppointment().start));

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

  it("drafts notify_caretaker without sending when approval is missing", async () => {
    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "model",
        sessionId: "notify-draft-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.preview).toBe(true);
    expect(body.sent).toBe(false);
    expect(body.draft).toMatchObject({
      summary: "Maria is running late.",
      urgency: "high",
    });
    expect(String(body.summary)).toMatch(/not sent/i);

    const events = auditLog.list();
    expect(events).toHaveLength(1);
    expect(events[0]?.proposed.tool).toBe("notify_caretaker");
    expect(events[0]?.approved?.allowed).toBe(true);
    expect(events[0]?.executed?.attempted).toBe(true);
    expect(events[0]?.outcome.reason).toBe("preview");
    expect(events[0]?.outcome.denied).toBeUndefined();

    const view = sessionViewSchema.parse(
      await (await app.request("/sessions/notify-draft-1")).json(),
    );
    expect(view.pendingApproval?.tool).toBe("notify_caretaker");
    expect(view.pendingApproval?.reason).toBe("confirmation_required");
    expect(view.caretakerActivity).toHaveLength(1);
    expect(view.caretakerActivity[0]?.sent).toBe(false);
    expect(view.caretakerActivity[0]?.preview).toBe(true);
  });

  it("does not send notify_caretaker when a model presents its own token", async () => {
    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "model",
        approvalToken: "tok_model",
      }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.denied).toBe(true);
    expect(body.reason).toBe("model_cannot_self_approve");
    expect(body.sent).toBe(false);
    expect(auditLog.list()[0]?.executed?.attempted).toBe(false);
  });

  it("does not call Gmail when notify_caretaker is only a preview", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute");
    await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "model",
        sessionId: "notify-draft-no-gmail",
      }),
    });
    expect(executeSpy).not.toHaveBeenCalled();
    executeSpy.mockRestore();
  });

  it("sends a caretaker email to Jules's Gmail with a human approval token", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "composio_session",
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      successful: true,
      logId: "gmail_send_1",
    });

    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: {
          summary: "Maria missed her medication reminder.",
          urgency: "normal",
          recipientName: "James Alvarez",
        },
        actor: "senior",
        approvalToken: "tok_yes",
        sessionId: "notify-send-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(true);
    expect(body.preview).toBe(false);
    expect(body.draft.recipientEmail).toBe("juleselvandrade@gmail.com");
    expect(body.draft.recipientName).toBe("James Alvarez");
    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
        arguments: expect.objectContaining({
          recipient_email: "juleselvandrade@gmail.com",
          body: "Maria missed her medication reminder.",
        }),
      }),
    );
    executeSpy.mockRestore();

    const events = auditLog.list();
    expect(events[0]?.approved?.allowed).toBe(true);
    expect(events[0]?.approved?.approvalTokenPresent).toBe(true);
    expect(events[0]?.executed?.attempted).toBe(true);
    expect(events[0]?.outcome.denied).toBeUndefined();

    const view = sessionViewSchema.parse(
      await (await app.request("/sessions/notify-send-1")).json(),
    );
    expect(view.pendingApproval).toBeNull();
    expect(view.caretakerActivity).toHaveLength(1);
    expect(view.caretakerActivity[0]?.sent).toBe(true);
    expect(view.caretakerActivity[0]?.preview).toBe(false);
    expect(view.caretakerActivity[0]?.summary).toBe("Maria missed her medication reminder.");
    expect(view.caretakerActivity[0]?.recipientName).toBe("James Alvarez");
    expect(view.caretakerActivity[0]?.recipientId).toBe("contact_james");
  });

  it("falls back to a mock email when Composio is not configured", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi
      .spyOn(kasamaComposio, "execute")
      .mockRejectedValue(new ComposioNotConfiguredError());

    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "senior",
        approvalToken: "tok_yes",
        sessionId: "notify-send-fallback",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(true);
    expect(body.confirmationId).toMatch(/^notify_/);
    expect(body.summary).toMatch(/email/i);
    executeSpy.mockRestore();
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
    const res = await app.request("/tools/get_appointment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { date: mariaAppointmentDay },
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
    expect(body.booking?.status).toBe("booked");
    expect(body.confirmationId).toBe("UBER-UBERX-0001");
    expect(body.booking?.provider).toBe("uber");
    expect(auditLog.list()[0]?.approved?.allowed).toBe(true);
    expect(auditLog.list()[0]?.executed?.attempted).toBe(true);
  });

  it("does not project lastBooking when book_ride cannot be verified", async () => {
    const res = await app.request("/tools/book_ride", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { optionId: "unknown_option" },
        actor: "senior",
        approvalToken: "tok_yes",
        sessionId: "bad-book",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.confirmationId).toBeUndefined();
    expect(sessionStore.get("bad-book").lastBooking).toBeNull();
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
  const tomorrow = mariaAppointmentDay;

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
    expect(body.tasks).toEqual([]);
    expect(body.lastMedicationReminder).toBeNull();
    expect(body.lastHospitalVisit).toBeNull();
  });

  it("seeds the iOS default session with Maria's ride thread so Chat and caretaker share it", async () => {
    const res = await app.request("/sessions/default");
    expect(res.status).toBe(200);
    const body = sessionViewSchema.parse(await res.json());
    expect(body.conversation.turns).toHaveLength(3);
    expect(body.conversation.chats.map((chat) => chat.title)).toEqual([
      "Hospital visit",
      "Medication reminder",
      "Doctor ride",
    ]);
    expect(body.conversation.activeChatId).toBe("chat_ride");
    expect(body.tasks.map((task) => task.title)).toEqual([
      "Lisinopril",
      "St. Mary's Hospital",
    ]);
    expect(body.conversation.turns[0]?.text).toBe(
      "Please get me a ride to my doctor tomorrow.",
    );
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.lastBooking?.confirmationId).toBe("UBER-WAV-SEED");
    expect(body.lastApproval?.decision).toBe("approved");

    const dashboard = buildCaretakerDashboard({ view: body });
    expect(dashboard.overviewStatus).toBe("confirmed");
    expect(dashboard.activity).toHaveLength(9);
  });

  it("starts a new chat on the same session without copying the ride thread", async () => {
    const res = await app.request("/conversation/chats", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "default" }),
    });
    expect(res.status).toBe(200);
    const body = conversationChatResponseSchema.parse(await res.json());
    expect(body.conversation.chats).toHaveLength(4);
    expect(body.conversation.activeChatId).toBe(body.chatId);
    expect(body.conversation.turns).toEqual([]);
    const ride = body.conversation.chats.find((chat) => chat.title === "Doctor ride");
    expect(ride?.turns).toHaveLength(3);
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
    expect(body.lastBooking?.status).toBe("booked");
    expect(body.lastBooking?.confirmationId).toMatch(/^UBER-UBERX-\d{4}$/);
    expect(body.lastBooking?.timestamp).toBeTruthy();
    expect(body.lastBooking?.consentGranted).toBe(true);
    expect(body.consentGranted).toBe(true);
    expect(body.pendingApproval).toBeNull();
    expect(body.currentRequest?.tool).toBe("book_ride");

    const dashboard = buildCaretakerDashboard({ view: body });
    expect(dashboard.overviewStatus).toBe("confirmed");
    expect(dashboard.overviewBadge).toBe("CONFIRMED");
    expect(dashboard.ride?.title).toBe("UberX");
    expect(dashboard.ride?.booked).toBe(true);
    expect(dashboard.ride?.confirmationId).toMatch(/^UBER-UBERX-\d{4}$/);
    expect(dashboard.consentItems[0]).toMatchObject({
      tone: "approved",
      title: "Ride booking approved",
    });
    expect(dashboard.careNotes).toMatch(/No diagnosis noted/);
  });

  it("lets senior and caretaker clients share the same sessionId", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "composio_session",
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      successful: true,
      logId: "gmail_send_test",
    });

    try {
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
    } finally {
      executeSpy.mockRestore();
    }
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

  it("starts with an empty conversation", async () => {
    const body = sessionViewSchema.parse(
      await (await app.request("/sessions/quiet")).json(),
    );
    expect(body.conversation).toEqual(emptyConversationState());
  });
});

describe("POST /approvals", () => {
  it("approves a pending Uber from the senior Yes button", async () => {
    await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: "Please get me a ride to my doctor tomorrow.",
        sessionId: "tap-1",
      }),
    });
    await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Yes", sessionId: "tap-1" }),
    });

    const res = await app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "tap-1", decision: "approve", actor: "senior" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision).toBe("approved");
    expect(body.pendingApproval).toBeNull();
    expect(sessionStore.get("tap-1").lastBooking?.optionId).toBe("uber_wav_1");
  });

  it("declines a pending Uber from the No button and writes the audit", async () => {
    await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: "Please get me a ride to my doctor tomorrow.",
        sessionId: "tap-2",
      }),
    });
    await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "Yes", sessionId: "tap-2" }),
    });

    const res = await app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "tap-2", decision: "decline", actor: "senior" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision).toBe("declined");
    expect(body.reply).toContain("will not book");
    expect(sessionStore.get("tap-2").lastBooking).toBeNull();
    expect(sessionStore.get("tap-2").lastApproval?.decision).toBe("declined");
    expect(auditLog.list().some((event) => event.outcome.reason === "declined_by_human")).toBe(true);
  });

  it("cancels a drafted caretaker message and never sends it", async () => {
    await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is going to the doctor.", urgency: "normal" },
        actor: "model",
        sessionId: "notify-cancel-1",
      }),
    });

    const res = await app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "notify-cancel-1",
        decision: "decline",
        actor: "senior",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.decision).toBe("declined");
    expect(body.reply).toContain("will not send");
    expect(sessionStore.get("notify-cancel-1").caretakerActivity.some((item) => item.sent)).toBe(
      false,
    );
    expect(auditLog.list().some((event) => event.outcome.reason === "declined_by_human")).toBe(true);
  });

  it("does not speak send success when Gmail failed", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "composio_session",
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      successful: false,
      error: "Gmail send failed.",
      logId: "gmail_send_fail",
    });

    try {
      await app.request("/tools/notify_caretaker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          input: { summary: "Maria is going to the doctor.", urgency: "normal" },
          actor: "model",
          sessionId: "notify-fail-1",
        }),
      });

      const res = await app.request("/approvals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: "notify-fail-1",
          decision: "approve",
          actor: "senior",
        }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.reply).not.toBe(approvedNotifyReply());
      expect(body.reply).toContain("Failed to send");

      const view = sessionStore.get("notify-fail-1");
      expect(view.conversation.failure).toEqual({
        kind: "retry",
        tool: "notify_caretaker",
        summary: body.reply,
      });
    } finally {
      executeSpy.mockRestore();
    }
  });

  it("rejects a model actor on the approval route", async () => {
    const res = await app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: "tap-3", decision: "approve", actor: "model" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /conversation/turn", () => {
  it("replies to the demo line and projects the turn into the shared session", async () => {
    const res = await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: "Please get me a ride to my doctor tomorrow.",
        sessionId: "family-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = conversationTurnResponseSchema.parse(await res.json());
    expect(body.kind).toBe("proposal");
    expect(body.reply).toContain("Dr. Chen");

    const view = sessionViewSchema.parse(
      await (await app.request("/sessions/family-1")).json(),
    );
    expect(view.conversation.turns).toHaveLength(2);
    expect(view.conversation.activeRequest?.intent).toBe("ride");
    expect(view.appointment?.id).toBe("appt_maria_doctor_01");
    expect(view.events.map((event) => event.proposed.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
    ]);
  });

  it("rejects non-JSON and empty transcripts", async () => {
    const notJson = await app.request("/conversation/turn", {
      method: "POST",
      body: "hello",
    });
    expect(notJson.status).toBe(400);

    const empty = await app.request("/conversation/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "" }),
    });
    expect(empty.status).toBe(400);
  });
});

describe("POST /playground", () => {
  it("returns appointment context, ride options, and a pending approval", async () => {
    const res = await app.request("/playground", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        transcript: PLAYGROUND_DEMO_TRANSCRIPT,
        sessionId: "http-play-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = playgroundResponseSchema.parse(await res.json());
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.rideOptions).toHaveLength(2);
    expect(body.pendingApproval?.tool).toBe("book_ride");
    expect(body.pendingApproval?.estimate).toBe("$24.50");
    expect(body.lastBooking).toBeNull();
    expect(body.seed.profileId).toBe("senior_maria");
  });

  it("rejects non-JSON and empty transcripts", async () => {
    const notJson = await app.request("/playground", {
      method: "POST",
      body: "hello",
    });
    expect(notJson.status).toBe(400);

    const empty = await app.request("/playground", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ transcript: "" }),
    });
    expect(empty.status).toBe(400);
  });
});

describe("POST /speech/transcribe", () => {
  function audioForm(): FormData {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/m4a" }), "clip.m4a");
    return form;
  }

  it("returns the transcript from the configured transcriber", async () => {
    const testApp = createApp({
      transcribe: async (audio, filename) => {
        expect(audio.size).toBe(3);
        expect(filename).toBe("clip.m4a");
        return "get me a ride to my doctor tomorrow";
      },
    });

    const res = await testApp.request("/speech/transcribe", {
      method: "POST",
      body: audioForm(),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transcript: "get me a ride to my doctor tomorrow" });
  });

  it("returns 501 stt_not_configured when no key is set", async () => {
    const testApp = createApp({
      transcribe: async () => {
        throw new SttNotConfiguredError();
      },
    });

    const res = await testApp.request("/speech/transcribe", {
      method: "POST",
      body: audioForm(),
    });
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("stt_not_configured");
  });

  it("returns 400 when no file is sent", async () => {
    const testApp = createApp({ transcribe: async () => "never" });
    const res = await testApp.request("/speech/transcribe", {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(400);
  });

  it("returns 502 when the provider fails", async () => {
    const testApp = createApp({
      transcribe: async () => {
        throw new Error("ElevenLabs speech-to-text failed (500).");
      },
    });
    const res = await testApp.request("/speech/transcribe", {
      method: "POST",
      body: audioForm(),
    });
    expect(res.status).toBe(502);
  });
});

describe("POST /speech/speak", () => {
  it("returns mpeg audio from the configured speaker", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const testApp = createApp({
      transcribe: async () => "unused",
      speak: async (text) => {
        expect(text).toBe("Should I set that up?");
        return { bytes, contentType: "audio/mpeg" };
      },
    });

    const res = await testApp.request("/speech/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Should I set that up?" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/audio\/mpeg/);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("returns 501 tts_not_configured when no key is set", async () => {
    const testApp = createApp({
      transcribe: async () => "unused",
      speak: async () => {
        throw new TtsNotConfiguredError();
      },
    });

    const res = await testApp.request("/speech/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello" }),
    });
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error).toBe("tts_not_configured");
  });

  it("rejects an empty reply", async () => {
    const testApp = createApp({
      transcribe: async () => "unused",
      speak: async () => {
        throw new Error("should not speak");
      },
    });
    const res = await testApp.request("/speech/speak", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }),
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /composio/connect and /composio/execute", () => {
  const unusedTranscribe = async () => "unused";

  it("returns 501 when Composio is not configured", async () => {
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new ComposioNotConfiguredError();
        },
        execute: async () => {
          throw new ComposioNotConfiguredError();
        },
      },
    });

    const res = await testApp.request("/composio/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(501);
    expect((await res.json()).error).toBe("composio_not_configured");
  });

  it("returns a Connect Link and then a profile result with a log id", async () => {
    const composio: KasamaComposio = {
      connect: async () => ({
        userId: "senior_maria",
        sessionId: "sess_1",
        toolkit: "gmail",
        connected: false,
        redirectUrl: "https://connect.composio.dev/link/ln_gmail",
      }),
      execute: async () => ({
        userId: "senior_maria",
        sessionId: "sess_1",
        toolSlug: COMPOSIO_DEFAULT_TOOL,
        successful: true,
        data: { emailAddress: "maria@example.com" },
        logId: "log_abc",
      }),
    };
    const testApp = createApp({ transcribe: unusedTranscribe, composio });

    const connect = await testApp.request("/composio/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(connect.status).toBe(200);
    expect(await connect.json()).toMatchObject({
      connected: false,
      redirectUrl: "https://connect.composio.dev/link/ln_gmail",
    });

    const execute = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(execute.status).toBe(200);
    expect(await execute.json()).toMatchObject({
      successful: true,
      toolSlug: COMPOSIO_DEFAULT_TOOL,
      logId: "log_abc",
    });
  });

  it("returns 409 when execute needs Gmail authorization", async () => {
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new Error("unused");
        },
        execute: async () => ({
          userId: "senior_maria",
          sessionId: "sess_1",
          toolSlug: COMPOSIO_DEFAULT_TOOL,
          successful: false,
          needsAuth: true,
          toolkit: "gmail",
          redirectUrl: "https://connect.composio.dev/link/ln_gmail",
        }),
      },
    });

    const res = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(409);
    expect((await res.json()).needsAuth).toBe(true);
  });

  it("creates a Gmail draft when the caller asks for the documented draft tool", async () => {
    const execute = async (input?: { toolSlug?: string }) => ({
      userId: "senior_maria",
      sessionId: "sess_1",
      toolSlug: input?.toolSlug ?? COMPOSIO_DEFAULT_TOOL,
      successful: true,
      data: { draft_id: "r-draft-1" },
      logId: "log_draft",
    });
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new Error("unused");
        },
        execute,
      },
    });

    const res = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      successful: true,
      toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
      logId: "log_draft",
      data: { draft_id: "r-draft-1" },
    });
  });

  it("returns 409 with a Connect Link when a draft execute needs Gmail authorization", async () => {
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new Error("unused");
        },
        execute: async (input?: { toolSlug?: string }) => ({
          userId: "senior_maria",
          sessionId: "sess_1",
          toolSlug: input?.toolSlug ?? COMPOSIO_DEFAULT_TOOL,
          successful: false,
          needsAuth: true,
          toolkit: "gmail",
          redirectUrl: "https://connect.composio.dev/link/ln_gmail",
        }),
      },
    });

    const res = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL }),
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      needsAuth: true,
      toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
      redirectUrl: "https://connect.composio.dev/link/ln_gmail",
    });
  });

  it("sends Gmail when the caller asks for the documented send tool", async () => {
    const execute = async (input?: { toolSlug?: string }) => ({
      userId: "senior_maria",
      sessionId: "sess_1",
      toolSlug: input?.toolSlug ?? COMPOSIO_DEFAULT_TOOL,
      successful: true,
      data: { id: "1a0bb8b230927c57" },
      logId: "log_send",
    });
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new Error("unused");
        },
        execute,
      },
    });

    const res = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolSlug: COMPOSIO_GMAIL_SEND_TOOL }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      successful: true,
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      logId: "log_send",
      data: { id: "1a0bb8b230927c57" },
    });
  });

  it("rejects GMAIL_SEND_DRAFT so only the documented send slug can send", async () => {
    const execute = async () => {
      throw new Error("send draft must not reach Composio");
    };
    const testApp = createApp({
      transcribe: unusedTranscribe,
      composio: {
        connect: async () => {
          throw new Error("unused");
        },
        execute,
      },
    });

    const res = await testApp.request("/composio/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ toolSlug: "GMAIL_SEND_DRAFT" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_request");
  });
});
