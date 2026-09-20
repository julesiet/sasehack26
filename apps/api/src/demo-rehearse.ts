import {
  DEMO_SCRIPT_TRANSCRIPTS,
  buildCaretakerDashboard,
  conversationTurnResponseSchema,
  type CaretakerDashboard,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runConversationTurn } from "./conversation";
import { sessionStore } from "./session-store";
import { resetControlledUberProvider } from "./uber-provider";

export type DemoRehearsalBeatId = "ride-request" | "choose-accessible" | "confirm";

export type DemoRehearsalBeat = {
  id: DemoRehearsalBeatId;
  transcript: string;
  reply: string;
  ok: boolean;
  detail?: string;
};

export type DemoRehearsalResult = {
  ok: boolean;
  sessionId: string;
  beats: DemoRehearsalBeat[];
  dashboard: CaretakerDashboard;
};

function includesAll(text: string, needles: string[]): boolean {
  return needles.every((needle) => text.toLowerCase().includes(needle.toLowerCase()));
}

/**
 * Runs the printed 3-minute ride script against the live-demo session.
 * Used by tests and `pnpm demo:rehearse`. Never talks to iOS.
 */
export async function runDemoRehearsal(input: { sessionId: string }): Promise<DemoRehearsalResult> {
  auditLog.clearSession(input.sessionId);
  resetControlledUberProvider();
  sessionStore.reset(input.sessionId, "live-demo");

  const beats: DemoRehearsalBeat[] = [];

  const request = await runConversationTurn({
    transcript: DEMO_SCRIPT_TRANSCRIPTS.rideRequest,
    sessionId: input.sessionId,
  });
  const requestBody = conversationTurnResponseSchema.parse(request.body);
  beats.push({
    id: "ride-request",
    transcript: DEMO_SCRIPT_TRANSCRIPTS.rideRequest,
    reply: requestBody.reply,
    ok:
      request.status === 200 &&
      requestBody.kind === "proposal" &&
      includesAll(requestBody.reply, ["Dr. Chen", "tomorrow", "Uber"]) &&
      /Should I set that up\?$/.test(requestBody.reply),
    detail: requestBody.reply,
  });

  const choose = await runConversationTurn({
    transcript: DEMO_SCRIPT_TRANSCRIPTS.chooseAccessible,
    sessionId: input.sessionId,
  });
  const chooseBody = conversationTurnResponseSchema.parse(choose.body);
  beats.push({
    id: "choose-accessible",
    transcript: DEMO_SCRIPT_TRANSCRIPTS.chooseAccessible,
    reply: chooseBody.reply,
    ok: choose.status === 200 && chooseBody.reply === "The Uber is $24.50. Should I book it?",
    detail: chooseBody.reply,
  });

  const confirm = await runConversationTurn({
    transcript: DEMO_SCRIPT_TRANSCRIPTS.confirm,
    sessionId: input.sessionId,
  });
  const confirmBody = conversationTurnResponseSchema.parse(confirm.body);
  beats.push({
    id: "confirm",
    transcript: DEMO_SCRIPT_TRANSCRIPTS.confirm,
    reply: confirmBody.reply,
    ok:
      confirm.status === 200 &&
      includesAll(confirmBody.reply, ["wheelchair Uber", "$24.50", "UBER-WAV-0001"]),
    detail: confirmBody.reply,
  });

  const view = sessionStore.get(input.sessionId);
  const dashboard = buildCaretakerDashboard({ view });
  const ok =
    beats.every((beat) => beat.ok) &&
    dashboard.overviewStatus === "confirmed" &&
    dashboard.ride?.confirmationId === "UBER-WAV-0001";

  return { ok, sessionId: input.sessionId, beats, dashboard };
}
