import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PLAYGROUND_DEMO_TRANSCRIPT,
  playgroundResponseSchema,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import type { ChatAssistantMessage, ChatComplete } from "./model";
import { parsePlaygroundArgs, playgroundHelp, runPlaygroundCli } from "./playground-cli";
import { runPlaygroundTurn } from "./playground";
import { sessionStore } from "./session-store";
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
});

async function playground(raw: unknown) {
  const result = await runPlaygroundTurn(raw);
  expect(result.status).toBe(200);
  return playgroundResponseSchema.parse(result.body);
}

function assistantTools(calls: Array<{ name: string; args: unknown }>): ChatAssistantMessage {
  return {
    role: "assistant",
    content: null,
    tool_calls: calls.map((call, index) => ({
      id: `call_${index + 1}`,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args) },
    })),
  };
}

function assistantText(content: string): ChatAssistantMessage {
  return { role: "assistant", content };
}

function scripted(replies: ChatAssistantMessage[]): ChatComplete {
  let index = 0;
  return async () => {
    const next = replies[index];
    index += 1;
    if (!next) throw new Error("unexpected extra ChatGPT call");
    return next;
  };
}

describe("runPlaygroundTurn", () => {
  it("runs the demo line to a $24.50 checkpoint without booking", async () => {
    const body = await playground({
      transcript: PLAYGROUND_DEMO_TRANSCRIPT,
      sessionId: "play-1",
    });

    expect(body.until).toBe("checkpoint");
    expect(body.acceptedPlan).toBe(true);
    expect(body.seed).toEqual({ profileId: "senior_maria", name: "Maria Alvarez" });
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.appointment?.title).toContain("Dr. Chen");
    expect(body.rideOptions.map((option) => option.product)).toEqual(["UberX", "WAV"]);
    expect(body.rideOptions.some((option) => option.accessible && option.estimate === "$24.50")).toBe(
      true,
    );
    expect(body.pendingApproval?.tool).toBe("book_ride");
    expect(body.pendingApproval?.prompt).toContain("Should I book it?");
    expect(body.pendingApproval?.estimate).toBe("$24.50");
    expect(body.lastBooking).toBeNull();
    expect(body.plan.steps.map((step) => step.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
      "book_ride",
    ]);
    expect(body.events.map((event) => event.proposed.tool)).toEqual([
      "get_appointment",
      "find_ride_options",
      "book_ride",
    ]);
    expect(body.events.at(-1)?.executed?.attempted).toBe(false);
    expect(sessionStore.get("play-1").lastBooking).toBeNull();
  });

  it("keeps until=turn as a proposal without opening the booking checkpoint", async () => {
    const body = await playground({
      transcript: PLAYGROUND_DEMO_TRANSCRIPT,
      sessionId: "play-turn",
      until: "turn",
    });

    expect(body.acceptedPlan).toBe(false);
    expect(body.kind).toBe("proposal");
    expect(body.reply).toMatch(/Should I set that up\?$/);
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
    expect(body.rideOptions).toHaveLength(2);
    expect(body.pendingApproval).toBeNull();
    expect(body.lastBooking).toBeNull();
  });

  it("returns a retry payload when a tool fails", async () => {
    const result = await runPlaygroundTurn(
      { transcript: "When is my appointment?", sessionId: "play-fail", until: "turn" },
      {
        complete: scripted([
          assistantTools([{ name: "get_appointment", args: { date: "" } }]),
          assistantText("I couldn't look that up."),
        ]),
      },
    );

    expect(result.status).toBe(200);
    const body = playgroundResponseSchema.parse(result.body);
    expect(body.failure).toMatchObject({ kind: "retry", tool: "get_appointment" });
    expect(body.pendingApproval).toBeNull();
    expect(body.lastBooking).toBeNull();
  });

  it("rejects an empty transcript", async () => {
    const result = await runPlaygroundTurn({ transcript: "   " });
    expect(result.status).toBe(400);
  });

  it("handles notify_caretaker drafting and sending", async () => {
    const sessionId = "notify-test";
    const input = { summary: "Maria needs her meds", urgency: "high" };

    // Mock Composio execute to avoid external API calls in tests
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "sess_mock",
      toolSlug: "GMAIL_SEND_EMAIL",
      successful: true,
      logId: "mock_composio_log_123",
    });

    // 1. No token -> Should draft
    const resultDraft = await runPlaygroundTurn(
      {
        transcript: "Notify my caretaker that I need my meds",
        sessionId,
        actor: "senior",
      },
      {
        complete: scripted([
          assistantTools([{ name: "notify_caretaker", args: input }]),
          assistantText("I've drafted a message for your caretaker."),
        ]),
      },
    );

    expect(resultDraft.status).toBe(200);
    const bodyDraft = playgroundResponseSchema.parse(resultDraft.body);
    expect(bodyDraft.pendingApproval?.tool).toBe("notify_caretaker");
    expect(sessionStore.get(sessionId).caretakerActivity.at(-1)).toMatchObject({
      summary: input.summary,
      sent: false,
      preview: true,
    });

    // 2. With token -> Should send
    // We bypass runPlaygroundTurn here to test the tool invocation directly with a token
    const { invokeTool } = await import("./invoke-tool");
    const sentResult = await invokeTool("notify_caretaker", {
      sessionId,
      actor: "senior",
      approvalToken: "valid-token",
      input,
    });

    expect(sentResult.status).toBe(200);
    expect(sentResult.body).toMatchObject({
      success: true,
      sent: true,
      preview: false,
    });

    executeSpy.mockRestore();

    // The session store update usually happens via the harness, but we can check the audit log
    // or manually apply the event if needed. In the app, invokeTool is called by the harness.
  });

  it("defaults the session id to playground", async () => {
    const body = await playground({ transcript: PLAYGROUND_DEMO_TRANSCRIPT });
    expect(body.sessionId).toBe("playground");
  });
});

describe("playground CLI", () => {
  it("defaults to the demo line and checkpoint mode", () => {
    expect(parsePlaygroundArgs([])).toEqual({
      transcript: PLAYGROUND_DEMO_TRANSCRIPT,
      sessionId: undefined,
      until: "checkpoint",
      help: false,
    });
  });

  it("parses until, session, and a custom utterance", () => {
    expect(
      parsePlaygroundArgs(["--until", "turn", "--session-id", "cli-1", "I", "need", "a", "ride"]),
    ).toEqual({
      transcript: "I need a ride",
      sessionId: "cli-1",
      until: "turn",
      help: false,
    });
  });

  it("ignores a leftover pnpm -- separator", () => {
    expect(parsePlaygroundArgs(["--", "--session-id", "cli-2"])).toEqual({
      transcript: PLAYGROUND_DEMO_TRANSCRIPT,
      sessionId: "cli-2",
      until: "checkpoint",
      help: false,
    });
  });

  it("prints JSON for the demo line without booking", async () => {
    const result = await runPlaygroundCli(["--session-id", "cli-demo"]);
    expect(result.status).toBe(0);
    const body = playgroundResponseSchema.parse(JSON.parse(result.text));
    expect(body.pendingApproval?.tool).toBe("book_ride");
    expect(body.lastBooking).toBeNull();
    expect(body.appointment?.id).toBe("appt_maria_doctor_01");
  });

  it("prints help", async () => {
    const result = await runPlaygroundCli(["--help"]);
    expect(result.status).toBe(0);
    expect(result.text).toBe(playgroundHelp());
    expect(result.text).toContain("POST /playground");
  });
});
