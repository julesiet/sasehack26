import {
  MARIA_PROFILE,
  MAX_PLAYGROUND_ADVANCE_TURNS,
  PLAYGROUND_DEFAULT_SESSION_ID,
  conversationTurnResponseSchema,
  playgroundRequestSchema,
  playgroundResponseSchema,
  type ConversationPlan,
  type ConversationTurnResponse,
  type PlaygroundResponse,
} from "@kasama/shared";
import { runConversationTurn, type ConversationHttpResult, type ConversationTurnDeps } from "./conversation";
import { sessionStore } from "./session-store";

/**
 * Developer playground (#13). Same policy + audit as the voice loop, plus
 * appointment, ride options, and the pending checkpoint in one payload.
 * Never auto-approves book / send / spend.
 */

const ACCEPT_PLAN = "yes";

function mergePlans(plans: ConversationPlan[]): ConversationPlan {
  return { steps: plans.flatMap((plan) => plan.steps) };
}

function toPlaygroundBody(input: {
  turn: ConversationTurnResponse;
  plan: ConversationPlan;
  until: PlaygroundResponse["until"];
  acceptedPlan: boolean;
}): PlaygroundResponse {
  const view = sessionStore.get(input.turn.sessionId);
  return playgroundResponseSchema.parse({
    sessionId: input.turn.sessionId,
    reply: input.turn.reply,
    kind: input.turn.kind,
    activeRequest: input.turn.activeRequest,
    clarificationsAsked: input.turn.clarificationsAsked,
    plan: input.plan,
    failure: input.turn.failure,
    pendingApproval: input.turn.pendingApproval,
    appointment: view.appointment,
    rideOptions: view.lastRideOptions,
    lastBooking: view.lastBooking,
    lastApproval: view.lastApproval,
    events: view.events,
    seed: {
      profileId: MARIA_PROFILE.id,
      name: MARIA_PROFILE.name,
    },
    until: input.until,
    acceptedPlan: input.acceptedPlan,
  });
}

export async function runPlaygroundTurn(
  raw: unknown,
  deps: ConversationTurnDeps = {},
): Promise<ConversationHttpResult> {
  const request = playgroundRequestSchema.safeParse(raw);
  if (!request.success) {
    return {
      status: 400,
      body: { success: false, summary: "Invalid request.", issues: request.error.issues },
    };
  }

  const sessionId = request.data.sessionId ?? PLAYGROUND_DEFAULT_SESSION_ID;
  const actor = request.data.actor;
  const until = request.data.until;

  const first = await runConversationTurn(
    { transcript: request.data.transcript, sessionId, actor },
    deps,
  );
  if (first.status !== 200) {
    return first;
  }

  let turn = conversationTurnResponseSchema.parse(first.body);
  const plans: ConversationPlan[] = [turn.plan];
  let acceptedPlan = false;
  let extra = 0;

  while (
    until === "checkpoint" &&
    extra < MAX_PLAYGROUND_ADVANCE_TURNS &&
    !turn.pendingApproval &&
    !turn.failure &&
    turn.kind === "proposal"
  ) {
    extra += 1;
    const next = await runConversationTurn({ transcript: ACCEPT_PLAN, sessionId, actor }, deps);
    if (next.status !== 200) {
      return next;
    }
    turn = conversationTurnResponseSchema.parse(next.body);
    plans.push(turn.plan);
    acceptedPlan = true;
  }

  return {
    status: 200,
    body: toPlaygroundBody({
      turn,
      plan: mergePlans(plans),
      until,
      acceptedPlan,
    }),
  };
}
