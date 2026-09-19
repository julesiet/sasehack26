# Architecture

Kasama is one React Native iOS app (senior + caretaker modes) talking to one TypeScript API. The product AI is **Kasama**, not “the agent”.

```text
Kasama (Expo, iOS)
  Senior mode: voice, Uber cards, spoken + tap confirmation
  Caretaker mode: activity, consent, care signals
        ↓
Kasama API (Hono)
  Intent / planning (later) · policy · tools · session · audit
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
| `apps/mobile` | `@kasama/mobile` | Expo iOS client. Placeholder Home / Senior / Caretaker. Hidden Dev toggle. |
| `apps/api` | `@kasama/api` | Hono server. Health, tool invoke, session, audit. |
| `packages/shared` | `@kasama/shared` | Zod contracts, `POLICY_TABLE`, audit schema. Imported by API and mobile. |

Do not add `apps/web` or an Android app. Do not move contracts out of `packages/shared`.

## Mobile

- Expo SDK in `apps/mobile`, Expo Go via `pnpm start` / `pnpm dev` or Simulator via `pnpm ios` (no dev client, so no native speech-to-text modules)
- `EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` (Simulator). On a phone, set it to `http://<mac-lan-ip>:3001` in `apps/mobile/.env` — that host is also used for the Expo QR (`REACT_NATIVE_PACKAGER_HOSTNAME`). The API listens on `0.0.0.0`.
- StyleSheet + tokens in `apps/mobile/src/theme.ts`
- Screens: `App.tsx` switches `HomeScreen` / `SeniorScreen` / `CaretakerScreen`
- Designed UI replaces those screens; it does not replace the API

### Senior conversation screen (`#4`)

`apps/mobile/src/screens/SeniorScreen.tsx`. Design baseline: white sky → warm glow → orange sun bowl, serif greeting, peach composer pill (text field + mic) and a separate `•••` button. One chrome; the orb, headline, and pill contents follow the conversation phase from `useKasamaConversation`:

| Phase | Orb | Headline | Pill |
|---|---|---|---|
| `idle` | sun, breathing | "Good morning / afternoon / evening" (or last reply) | text field, white mic |
| `listening` | rings pulse out | "I'm listening." + "Tap the orange button when you're done." | waveform, orange stop |
| `thinking` | slow turn, dimmer | Maria's words quoted + "Thinking…" | `• • •`, mic disabled |
| `speaking` | bright pulse | `KASAMA` + reply (serif, 30pt) | text field, stop (interrupt) |
| `clarify` | sun | reply + "You can answer out loud or type below." | placeholder "Say or type your answer" |
| `micDenied` | gray, mic-off; bowl gray | "Kasama can't hear you yet." + Settings instruction + **Open Settings** | text field stays usable |
| `error` | sun | large recoverable message | text field, mic |

Text ≥ 28pt for anything Maria must read; tap targets ≥ 68pt. Ride cards and confirmation are `#8`, not this screen.

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

`GET /sessions/:sessionId` returns a `sessionViewSchema` projection from the process-local store (`apps/api/src/session-store.ts`): current request, pending approval, appointment, last Uber booking, caretaker activity, Maria-seed care signal (`"worth reviewing"`), consent, and that session's audit events in append order. Unknown ids return an empty pollable view (200), not 404.

`GET /audit` returns `{ events }` from the process-local log (`apps/api/src/audit-log.ts`). Optional `?sessionId=` filters. Not durable.

### Conversation (`#4`)

`POST /conversation/turn` body `{ transcript, sessionId?, actor?: "senior" | "caretaker" }` → `{ sessionId, reply, kind: "answer" | "clarification" | "proposal", activeRequest, clarificationsAsked }` (`conversationTurnRequestSchema` / `conversationTurnResponseSchema`).

`apps/api/src/conversation.ts` is a deterministic, rules-based turn so the demo line works without a model key. It is the seam the harness (`#5`) replaces. Rules it must keep:

- Every tool call goes through `invokeTool` as `actor: "model"`, so policy and audit apply (`get_appointment`, `find_ride_options`). It never calls `book_ride`; "yes" marks the request `accepted` and the ride card / approval is `#8`.
- At most `MAX_CLARIFICATIONS_PER_REQUEST` (1) clarifying question per request. A second vague answer drops the request gracefully.
- Session memory: `sessionView.conversation` = `{ turns, activeRequest, clarificationsAsked }`. Maria can say "yes" on the next turn without restating the appointment.

`POST /speech/transcribe` — multipart `file` (m4a) → `{ transcript }` via ElevenLabs Scribe (`apps/api/src/speech.ts`, `ELEVENLABS_API_KEY`). `501 { error: "stt_not_configured" }` when no key; `502` on provider failure.

`POST /speech/speak` — `{ text }` → MPEG audio of Kasama via ElevenLabs TTS (same key; optional `ELEVENLABS_VOICE_ID`, default Sarah / `EXAVITQu4vr4xnSDxMaL`). `501 { error: "tts_not_configured" }` when no key. The iOS app plays the clip with `expo-audio` and falls back to `expo-speech`. Keys never reach the app. The ElevenLabs key needs **Speech to Text** and **Text to Speech**.

### Composio (Gmail)

Live provider tools go through Composio Platform sessions (`apps/api/src/composio.ts`), not a parallel agent. Identity is Maria's existing id (`senior_maria`). The SDK reads `COMPOSIO_API_KEY` from the environment.

- `POST /composio/connect` — create or resume a session and return a Gmail Connect Link when the account is not connected
- `POST /composio/execute` — `session.execute`. First verified tool is `GMAIL_GET_PROFILE` (`user_id: "me"`). `409` + Connect Link if Gmail is not authorized

Calendar and Uber stay stubs. Do not send caretaker mail through Composio until `notify_caretaker` policy still gates it.

## Shared contracts

- `packages/shared/src/tools.ts` — tool names, inputs, results (Uber products: `UberX`, `WAV`)
- `packages/shared/src/policy.ts` — `POLICY_TABLE`, `evaluateAction`, `evaluateToolCall`
- `packages/shared/src/audit.ts` — event shape + `createAuditLog()`
- `packages/shared/src/invoke.ts` — HTTP request schema
- `packages/shared/src/session.ts` — session view Zod types (`sessionViewSchema`, `DEFAULT_SESSION_ID`); includes `conversation`
- `packages/shared/src/conversation.ts` — voice loop contracts: turn request/response, `activeRequest`, `MAX_CLARIFICATIONS_PER_REQUEST`, transcribe response
- `packages/shared/src/composio.ts` — Composio connect/execute schemas; default toolkit `gmail`, default tool `GMAIL_GET_PROFILE`
- `packages/shared/src/seed.ts` — Maria's demo fixtures: profile, tomorrow's doctor appointment (+ `computeArrivalTarget`), caretaker preferences/escalation rules, wearable trend, prior-request/confusion markers. `getMariaSeedBundle()` is the single entry point for the caretaker dashboard (`#9`) and care-signal work (`#10`/`#15`).
- `packages/shared/src/index.ts` — re-exports

If you add a tool, add it to `tools.ts`, map it in `TOOL_ACTIONS`, handle it in `apps/api/src/invoke-tool.ts`, project any session fields in `apps/api/src/session-store.ts`, add tests, and update this file.

Composio session tools (`GMAIL_GET_PROFILE` and later Gmail writes) live on `POST /composio/*` until a Kasama tool is wired through `invokeTool` + policy.

## Uber

Booking is through Uber. `find_ride_options` / `book_ride` are Uber-shaped. Live Uber (API or Browserbase) is issue `#14` / `#7`. Until then stubs return structured `{ success, summary, ... }` and still go through policy.

Fallback if live Uber is blocked: a controlled Uber-shaped environment — still presented as Uber, not a generic cab.

## What is not built yet

Agent harness / playground (`#5`, `#13`), live calendar + Uber (`#7`, `#14`), designed UI (`#6`, `#8`, `#9`), care-signal UI (`#10`), notify UI (`#11`). Session HTTP (`#18`) is built: poll `GET /sessions/:sessionId`.

Voice loop (`#4`) is built with a rules-based turn: designed senior screen, on-device recording + speech, `POST /conversation/turn`, `POST /speech/transcribe`. Live speech-to-text needs `ELEVENLABS_API_KEY` in `apps/api/.env`; without it the screen falls back to typing. The model-driven turn is `#5`.

Composio Platform sessions are on `POST /composio/connect` and `POST /composio/execute` (Gmail / `GMAIL_GET_PROFILE` for `senior_maria`). They are not wired into the conversation turn or `notify_caretaker` yet.

Maria's seed data (`#2`) is built: `get_appointment` returns her real appointment (still a stub for every other date, since live calendar is `#7`).

## Keeping architecture context shared

When this diagram, a package, a route, or a tool changes, update **this file** and [AGENTS.md](AGENTS.md). Do not start a second architecture doc.
