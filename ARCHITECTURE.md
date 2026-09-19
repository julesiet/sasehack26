# Architecture

Kasama is one React Native iOS app (senior + caretaker modes) talking to one TypeScript API. The product AI is **Kasama**, not “the agent”.

```text
Kasama (Expo, iOS)
  Senior mode: voice, Uber cards, spoken + tap confirmation
  Caretaker mode: activity, consent, care signals
        ↓
Kasama API (Hono)
  Intent / planning (ChatGPT) · policy · tools · session · audit
        ↓
Tools
  get_appointment · find_ride_options (Uber) · book_ride (Uber) · notify_caretaker
```

Core loop:

```text
Senior speaks on iPhone → Kasama understands intent → Kasama gathers care context
→ Kasama proposes an action → Senior/caretaker approves on device → Kasama executes and verifies
```

## Packages

| Path | Name | Role |
|---|---|---|
| `apps/mobile` | `@kasama/mobile` | Expo iOS client. Home unchanged. Senior greeting, then chat + confirmation card. Caretaker shows pending/last approval. Hidden Dev toggle. |
| `apps/api` | `@kasama/api` | Hono server. Health, tool invoke, session, audit. |
| `packages/shared` | `@kasama/shared` | Zod contracts, `POLICY_TABLE`, audit schema. Imported by API and mobile. |

Do not add `apps/web` or an Android app. Do not move contracts out of `packages/shared`.

## Mobile

- Expo SDK in `apps/mobile`, Expo Go via `pnpm start` / `pnpm dev` or Simulator via `pnpm ios` (no dev client, so no native speech-to-text modules)
- `EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` (Simulator). On a phone, set it to `http://<mac-lan-ip>:3001` in `apps/mobile/.env` — that host is also used for the Expo QR (`REACT_NATIVE_PACKAGER_HOSTNAME`). The API listens on `0.0.0.0`.
- StyleSheet + tokens in `apps/mobile/src/theme.ts`
- Screens: `App.tsx` switches `HomeScreen` / `SeniorScreen` / `CaretakerScreen`. `HomeScreen` is unchanged. Senior tabs: **Home** (sun welcome), **Chat** (last started conversation), **Tasks** (empty). Chat is disabled until Kasama has replied. Active tab is sun orange. Composer stays on Home and Chat, above a compact tab bar. On Home the bar overlays the sun at 80% opacity so the bowl is not hard-cropped; Chat and Tasks stay solid. Spacing vs the home indicator is interim — polish is [#27](https://github.com/julesiet/sasehack26/issues/27).
- Designed UI replaces those screens; it does not replace the API

### Senior conversation screen (`#4`)

`apps/mobile/src/screens/SeniorScreen.tsx`. **Home** is the sun greeting. After Kasama's first reply, **Chat** opens `SeniorChatScreen` (Maria's dark bubbles on the right). Tapping Home always returns to the welcome. The confirmation card only appears while a high-risk action is waiting (or just after Confirm / Cancel).

| Phase | Greeting (before first reply) | Chat (after first reply) | Pill |
|---|---|---|---|
| `idle` | sun + "Good morning / afternoon / evening" | last bubbles | text field, white mic |
| `listening` | "I'm listening." | hint in the thread | waveform, orange stop |
| `thinking` | Maria's words quoted | "Thinking…" in the thread | `• • •`, mic disabled |
| `speaking` | — | new Kasama bubble | text field, stop (interrupt) |
| `clarify` | — | bubble + type/speak | placeholder "Your answer" |
| `approving` | — | confirmation card in the thread | mic still works |
| `micDenied` | Settings recovery | Settings recovery in the thread | text field stays usable |
| `error` | large recoverable message | same, in the thread | text field, mic |

Text Maria must act on stays large; chat bubbles are 22pt so a thread fits. Tap targets ≥ 68pt. Approval checkpoints (`#6`) are a descriptive card (place, reason, time, $24.50 WAV) with **Cancel** / **Confirm**. The saved/declined card shows only for that decision, then the thread continues. Ride option cards are still `#8`.

Loop: mic → `expo-audio` records (≤ 15 s or tap) → `POST /speech/transcribe` → `POST /conversation/turn` → `POST /speech/speak` (ElevenLabs) → play on device. If STT is `501`, the screen tells Maria to type. If TTS is `501`, the device falls back to `expo-speech`. Session id is `DEFAULT_SESSION_ID` so the caretaker view polls the same conversation.

## API

Entry: `apps/api/src/index.ts` listens on `0.0.0.0` / `PORT` (default 3001) so a phone can use the Mac's LAN IP. App routes live in `apps/api/src/app.ts`.

`POST /tools/:name` body:

```json
{
  "input": { },
  "actor": "model" | "senior" | "caretaker" | "doctor",
  "approvalToken": "optional-human-token",
  "sessionId": "optional",
  "consentGranted": false,
  "recipient": "optional",
  "allowedRecipients": []
}
```

Flow: parse name → Zod input → `evaluateToolCall` → stub execute if allowed → append audit → update session projection (or 403).

Omitted `sessionId` is stored as `default` (`DEFAULT_SESSION_ID` in `packages/shared/src/session.ts`). Senior and caretaker clients share one `sessionId` and poll the same view.

`GET /sessions/:sessionId` returns a `sessionViewSchema` projection from the process-local store (`apps/api/src/session-store.ts`): current request, pending approval, last approval, last Uber options, appointment, last Uber booking, caretaker activity, Maria-seed care signal (`"worth reviewing"`), consent, and that session's audit events in append order. Unknown ids return an empty pollable view (200), not 404. The caretaker screen polls this for Maria's yes/no.

`GET /audit` returns `{ events }` from the process-local log (`apps/api/src/audit-log.ts`). Optional `?sessionId=` filters. Not durable.

### Conversation (`#4`) and harness (`#5`)

`POST /conversation/turn` body `{ transcript, sessionId?, actor?: "senior" | "caretaker" }` → `{ sessionId, reply, kind: "answer" | "clarification" | "proposal", activeRequest, clarificationsAsked, plan, failure, pendingApproval }` (`conversationTurnRequestSchema` / `conversationTurnResponseSchema`).

`POST /approvals` body `{ decision: "approve" | "decline", sessionId?, actor?: "senior" | "caretaker" }` → `{ sessionId, decision, reply, pendingApproval, lastApproval }`. Tap Yes / No on the iPhone. Voice yes/no uses the same resolver. Actor `model` is rejected.

When `MODEL_API_KEY` is set, `apps/api/src/harness.ts` asks ChatGPT (Chat Completions, default `gpt-4o-mini`, optional `MODEL_NAME`) to propose Kasama tools. Each call runs through `invokeTool` as `actor: "model"`. If the key is missing or OpenAI throws, `apps/api/src/conversation.ts` uses the original rules-based turn. Composio is not on this loop.

Rules the harness keeps:

- Every tool call goes through `invokeTool`, so policy and audit apply (`get_appointment`, `find_ride_options`). `book_ride` / `notify_caretaker` from the model are denied (`confirmation_required`) — not a failure. That denial becomes `pendingApproval`. The first "yes" on a ride plan asks "The Uber is $24.50. Should I book it?" A second human yes, or `POST /approvals`, books as `senior` with a token. "No" logs `declined_by_human` and does not execute.
- At most `MAX_CLARIFICATIONS_PER_REQUEST` (1) clarifying question per request. At most `MAX_TOOL_ROUNDS_PER_TURN` (4) ChatGPT tool rounds; hitting the cap is a `handoff`.
- `plan.steps` lists tools run this turn (`ok` / `denied` / `failed`). `failure` is `retry` or `handoff` when a tool actually failed — never a fake booking.
- Session memory: `sessionView.conversation` = `{ turns, activeRequest, clarificationsAsked, plan, failure }`. Maria can say "yes" on the next turn without restating the appointment.

`POST /speech/transcribe` — multipart `file` (m4a) → `{ transcript }` via ElevenLabs Scribe (`apps/api/src/speech.ts`, `ELEVENLABS_API_KEY`). `501 { error: "stt_not_configured" }` when no key; `502` on provider failure.

`POST /speech/speak` — `{ text }` → MPEG audio of Kasama via ElevenLabs TTS (same key; optional `ELEVENLABS_VOICE_ID`, default Sarah / `EXAVITQu4vr4xnSDxMaL`). `501 { error: "tts_not_configured" }` when no key. The iOS app plays the clip with `expo-audio` and falls back to `expo-speech`. Keys never reach the app. The ElevenLabs key needs **Speech to Text** and **Text to Speech**.

### Composio (Gmail)

Live provider tools go through Composio Platform sessions (`apps/api/src/composio.ts`), not a parallel agent. Identity is Maria's existing id (`senior_maria`). The SDK reads `COMPOSIO_API_KEY` from the environment.

- `POST /composio/connect` — create or resume a session and return a Gmail Connect Link when the account is not connected
- `POST /composio/execute` — `session.execute`. Default remains `GMAIL_GET_PROFILE` (`user_id: "me"`). Pass `toolSlug: "GMAIL_CREATE_EMAIL_DRAFT"` or `GMAIL_SEND_EMAIL` (documented at https://docs.composio.dev/toolkits/gmail.md). Omitted caretaker fields fill `GMAIL_CARETAKER_DRAFT_ARGUMENTS` / `GMAIL_CARETAKER_SEND_ARGUMENTS` (`juleselvandrade@gmail.com`). `GMAIL_SEND_DRAFT` is rejected. `409` + Connect Link if Gmail is not authorized

Calendar stays seeded; Uber uses the controlled provider. Do not send caretaker mail through Composio until `notify_caretaker` policy still gates it.

## Shared contracts

- `packages/shared/src/tools.ts` — tool names, inputs, results (Uber products: `UberX`, `WAV`)
- `packages/shared/src/policy.ts` — `POLICY_TABLE`, `evaluateAction`, `evaluateToolCall`
- `packages/shared/src/audit.ts` — event shape + `createAuditLog()`
- `packages/shared/src/invoke.ts` — HTTP request schema
- `packages/shared/src/approval.ts` — pending/last approval, `POST /approvals` body/response, $24.50 demo prompt helpers
- `packages/shared/src/session.ts` — session view Zod types (`sessionViewSchema`, `DEFAULT_SESSION_ID`); includes `conversation`, `pendingApproval`, `lastApproval`, `lastRideOptions`
- `packages/shared/src/conversation.ts` — voice loop contracts: turn request/response, `activeRequest`, `plan`, `failure`, `pendingApproval`, `MAX_CLARIFICATIONS_PER_REQUEST`, `MAX_TOOL_ROUNDS_PER_TURN`, transcribe response
- `packages/shared/src/composio.ts` — Composio connect/execute schemas; default toolkit `gmail`, default tool `GMAIL_GET_PROFILE`, optional `GMAIL_CREATE_EMAIL_DRAFT` / `GMAIL_SEND_EMAIL`
- `packages/shared/src/seed.ts` — Maria's demo fixtures: profile, tomorrow's doctor appointment (+ `computeArrivalTarget`), caretaker preferences/escalation rules, wearable trend, prior-request/confusion markers. `getMariaSeedBundle()` is the single entry point for the caretaker dashboard (`#9`) and care-signal work (`#10`/`#15`).
- `packages/shared/src/index.ts` — re-exports

If you add a tool, add it to `tools.ts`, map it in `TOOL_ACTIONS`, handle it in `apps/api/src/invoke-tool.ts`, project any session fields in `apps/api/src/session-store.ts`, add tests, and update this file.

Composio session tools (`GMAIL_GET_PROFILE`, `GMAIL_CREATE_EMAIL_DRAFT`, `GMAIL_SEND_EMAIL`) live on `POST /composio/*` until a Kasama tool is wired through `invokeTool` + policy. Conversation still cannot send.

## Uber

Booking is through Uber. `find_ride_options` / `book_ride` go through `apps/api/src/uber-provider.ts` (`UberProvider.findOptions` / `book`). This issue ships a controlled in-process implementation: two products (UberX ~$18, WAV ~$24.50), speakable confirmation ids (`UBER-WAV-0001`), and `success: true` only when the provider can re-read the booking it just wrote. Policy still requires a human token to book.

Live Uber (official API or Browserbase) is issue `#14`. A later adapter implements the same `UberProvider` interface. Until then the product names and confirmation still read as Uber, not a generic cab.

## What is not built yet

Agent playground (`#13`), live Uber (`#14`), ride-option cards (`#8`), caretaker dashboard (`#9`), care-signal UI (`#10`), notify UI (`#11`). Session HTTP (`#18`) is built: poll `GET /sessions/:sessionId`.

Voice loop (`#4`), harness (`#5`), and approval checkpoints (`#6`) are built: designed senior screen, on-device recording + speech, `POST /conversation/turn`, `POST /approvals`, `POST /speech/transcribe`. Live speech-to-text needs `ELEVENLABS_API_KEY` in `apps/api/.env`; without it the screen falls back to typing. `find_ride_options` / `book_ride` use the controlled Uber provider (UberX + WAV, $24.50 checkpoint price); live execute against Uber is still `#14`.

Composio Platform sessions are on `POST /composio/connect` and `POST /composio/execute` (Gmail / `GMAIL_GET_PROFILE` default; `GMAIL_CREATE_EMAIL_DRAFT` or `GMAIL_SEND_EMAIL` when asked) for `senior_maria`. They are not wired into the conversation turn or `notify_caretaker` yet.

Maria's seed data (`#2`) is built: `get_appointment` still uses Maria's seed (live calendar is out of scope; Composio later if cheap).

## Keeping architecture context shared

When this diagram, a package, a route, or a tool changes, update **this file** and [AGENTS.md](AGENTS.md). Do not start a second architecture doc.
