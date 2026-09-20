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
  save_medication_reminder (Tasks) · save_hospital_visit (local details)
```

Core loop:

```text
Senior speaks on iPhone → Kasama understands intent → Kasama gathers care context
→ Kasama proposes an action → Senior/caretaker approves on device → Kasama executes and verifies
```

## Packages

| Path | Name | Role |
|---|---|---|
| `apps/mobile` | `@kasama/mobile` | Expo iOS client. Home unchanged. Senior greeting, then chat + confirmation card. Caretaker dashboard (#9) polls the same session. Hidden Dev toggle. |
| `apps/api` | `@kasama/api` | Hono server. Health, tool invoke, session, audit, text playground. |
| `packages/shared` | `@kasama/shared` | Zod contracts, `POLICY_TABLE`, audit schema. Imported by API and mobile. |

Do not add `apps/web` or an Android app. Do not move contracts out of `packages/shared`.

CI: GitHub Actions (`.github/workflows/ci.yml`) on pull requests and `main` runs `pnpm typecheck` and `pnpm test` with Node 20 and pnpm 9. No product secrets.

## Mobile

- Expo SDK in `apps/mobile`, Expo Go via `pnpm start` / `pnpm dev` (Mac or Windows) or Simulator via `pnpm ios` on a Mac (no dev client, so no native speech-to-text modules)
- `EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` (Simulator). `pnpm start` / `pnpm dev` detect a LAN IPv4 and point both the Expo QR (`REACT_NATIVE_PACKAGER_HOSTNAME`) and the API URL at that host so Expo Go on a phone works. Override in `apps/mobile/.env` if the wrong NIC is chosen. If the QR cannot connect (Windows Firewall, guest Wi-Fi), `pnpm start:tunnel`. The API listens on `0.0.0.0`.
- StyleSheet + tokens in `apps/mobile/src/theme.ts`
- Screens: `App.tsx` switches `HomeScreen` / `SeniorScreen` / `CaretakerScreen` (care-aware view opens from Care notes inside caretaker mode). `HomeScreen` is unchanged. Senior tabs: **Home** (sun welcome), **Chat** (history list with short topic labels, current thread first; tap to open), **Tasks** (confirmed medication reminders and saved hospital visits). Chat is available when the session has chats (seeded on `default`). Active tab is sun orange. Composer stays on Home and on an open thread, above a compact tab bar. On Home the bar overlays the sun at 80% opacity so the bowl is not hard-cropped; Chat and Tasks stay solid. Spacing vs the home indicator is interim — polish is [#27](https://github.com/julesiet/sasehack26/issues/27). Demo role switch: Home **Dev** → Senior / Caretaker; Caretaker **Maria** opens Senior on the same phone.
- Designed UI replaces those screens; it does not replace the API

### Caretaker dashboard (`#9`)

`apps/mobile/src/screens/CaretakerScreen.tsx`. Family view of Maria's same `DEFAULT_SESSION_ID`. The `default` session is created with `getMariaDemoSession()` so Overview already has appointment, wheelchair Uber, consent, the doctor-ride thread, a Lisinopril reminder, and a St. Mary's visit. Polls `GET /sessions/:sessionId` every 2s so a later senior booking replaces that seed. Projection is `buildCaretakerDashboard()` in `packages/shared/src/caretaker-dashboard.ts`. Layout matches the designed iPhone: date + “Hello, Margaret”, care notes (worth reviewing, 15-minute lead, “No diagnosis noted”), contacts (James Alvarez, Jules, Sarah, Emily), then a cream-to-peach Overview wash with appointment, selected ride, consent / approval record, a **FAMILY UPDATE** card when `notify_caretaker` is drafted / sent / not sent (recipient, relationship, message, urgency, health sharing, Preview only while still a draft), and activity summary (all chats, oldest first). Badge is `CONFIRMED` / `WAITING` / `DECLINED`. Care notes never diagnose. Tapping Care notes opens the care-aware view (`#10`); the orange arrow returns here. Invites are not sent. Other session ids stay empty for tests and the playground.

### Care-aware view (`#10`)

`apps/mobile/src/screens/CareAwareScreen.tsx`. Opened from the caretaker dashboard Care notes card. Projection is `buildCareAwareView()` in `packages/shared/src/care-aware.ts` (usage, response times, repeated-question note, worth-reviewing quote, and quick actions from Maria's seed). Layout matches caretaker Overview: cream sky, then a peach wash of the same white cards (total usage, repeated questions, response time, worth reviewing). Remind and prepare-doctor-summary stay local and do not send, book, or diagnose. **Notify daughter** drafts `notify_caretaker` on the shared `default` session (display recipient Sarah; delivery is Jules's Gmail). The sheet is Preview only until Confirm: recipient, relationship, exact message, urgency, whether health information is included, and 68pt Cancel / Confirm. Confirm on the sheet sends as `actor: "caretaker"` through `POST /approvals`; Cancel, the backdrop, and `onRequestClose` decline the same way. The orange arrow goes back to the caretaker dashboard.

### Senior conversation screen (`#4`)

`apps/mobile/src/screens/SeniorScreen.tsx`. **Home** is the sun greeting. **Chat** opens the history list (`ChatHistoryScreen`): newest thread first, titles are short topic labels (**Doctor ride**, **Medication reminder**, **Hospital visit**). Tapping a row opens that thread in `SeniorChatScreen`. **New chat** starts an empty thread on the same session (`POST /conversation/chats`). Tapping Home always returns to the welcome. The confirmation card only appears while a high-risk action is waiting (or just after Confirm / Cancel) on the live thread.

| Phase | Greeting (before first reply) | Chat (after first reply) | Pill |
|---|---|---|---|
| `idle` | sun + "Good morning / afternoon / evening" | last bubbles | text field, white mic |
| `listening` | "I'm listening." | hint in the thread | waveform, orange stop |
| `thinking` | Maria's words quoted; "Finding Ubers…" / "Booking your Uber…" when that work is running | "Thinking…" or the current-action ride card | `• • •`, mic disabled |
| `speaking` | — | new Kasama bubble | text field, stop (interrupt) |
| `clarify` | — | bubble + type/speak | placeholder "Your answer" |
| `approving` | — | confirmation card in the thread | mic still works |
| `micDenied` | Settings recovery | Settings recovery in the thread | text field stays usable |
| `error` | large recoverable message | same, in the thread | text field, mic |

Text Maria must act on stays large; chat bubbles are 22pt so a thread fits. Tap targets ≥ 68pt. Ride options (`#8`) are two large Uber rows (UberX and wheelchair WAV) with the price on the right; the selected row uses the orange border. Approval checkpoints (`#6`) are a descriptive card (place, reason, time, selected Uber product + price) with **Cancel** / **Confirm**. Finding / booking never looks idle — a current-action card stays on screen. After Confirm the booked card reads back the product, price, and confirmation id. Declined and failed bookings stay honest (nothing charged). Medication reminders (`#41`) are a blue **Add this to your tasks?** card (name, frequency, Cancel / Confirm). Confirming does not change a prescription. A health-sync miss shows a recoverable error (retry or save locally). Hospital scheduling is a chat thread plus an appointment card (St. Mary's Hospital, reason, speakable time like Thursday at 10:00 AM) with Cancel / Confirm and an **Appointment details saved** state. That saved card is just-finished — it leaves Chat on the next question, same as ride confirmation. Family email previews (`#11`) are a **MESSAGE TO** card: recipient name, relationship (Son / Daughter / Family), the exact message, urgency, whether health information is included, a clear **Preview only** state, and 68pt+ Cancel / Confirm. Voice yes/no uses the same spoken analysis. After Confirm the card stays Sent with those facts; Cancel stays Not sent. Nothing is sent until Confirm. Confirmed reminders and saved visits land on **Tasks**.

Loop: mic → `expo-audio` records (≤ 15 s or tap) → `POST /speech/transcribe` → `POST /conversation/turn` → `POST /speech/speak` (ElevenLabs) → play on device. If STT is `501`, the screen tells Maria to type. If TTS is `501`, the device falls back to `expo-speech`. TTS speed and device rate follow Maria's `speaksSlowly` preference (`#31`). A ride or family-email checkpoint is spoken twice when `repeatsConfirmations` is on; Chat and the card stay the single sentence. Session id is `DEFAULT_SESSION_ID` so the caretaker view polls the same conversation.

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

`GET /sessions/:sessionId` returns a `sessionViewSchema` projection from the process-local store (`apps/api/src/session-store.ts`): current request, pending approval, last approval, last Uber options, appointment, last Uber booking, last medication reminder, last hospital visit, tasks, caretaker activity, caretaker narrative (`caretakerNarrative` from audit + session, `#33`), Maria-seed care signal (`"worth reviewing"`), consent, `conversation.chats` plus the active chat's `turns`, and that session's audit events in append order. Unknown ids return an empty pollable view (200), not 404. The caretaker screen polls this for Maria's yes/no.

`POST /conversation/chats` body `{ sessionId?, chatId? }` starts a new thread or selects an existing one. New chats are explicit — topics do not split on their own.

### Playground (`#13`)

`POST /playground` is the text / HTTP playground. Body `{ transcript, sessionId?, actor?: "senior" | "caretaker", until?: "checkpoint" | "turn" }` → `{ sessionId, reply, kind, plan, failure, pendingApproval, appointment, rideOptions, lastBooking, lastApproval, events, seed, until, acceptedPlan }` (`playgroundRequestSchema` / `playgroundResponseSchema`).

Default `until` is `checkpoint`: one utterance of “Please get me a ride to my doctor tomorrow.” looks up Maria's seeded appointment, searches Uber, accepts the conversational plan, and returns the $24.50 WAV checkpoint as `pendingApproval`. It does **not** book. A spoken family email (“send an email to james alvarez saying i missed my medication”) drafts `notify_caretaker` and stops at that preview — it does **not** send. `until: "turn"` is a single conversation turn (same as `POST /conversation/turn`) plus the extra session fields. Failed tools still return `failure.kind` `retry` or `handoff`.

Default `sessionId` is `playground` so curling it does not collide with the iOS `default` session. Same `invokeTool` path, so policy and audit apply. `pnpm playground` runs the same function in-process (no API required). Out of scope: any designed conversation UI.

Coding agents should use this playground to verify conversation, harness, tools, policy, and retries. It is the intended test surface when iOS UI is not ready or not in scope.

`GET /audit` returns `{ events }` from the process-local log (`apps/api/src/audit-log.ts`). Optional `?sessionId=` filters. Not durable.

### Conversation (`#4`) and harness (`#5`)

`POST /conversation/turn` body `{ transcript, sessionId?, actor?: "senior" | "caretaker" }` → `{ sessionId, reply, kind: "answer" | "clarification" | "proposal", activeRequest, clarificationsAsked, plan, failure, pendingApproval }` (`conversationTurnRequestSchema` / `conversationTurnResponseSchema`).

`POST /playground` is the text playground (`#13`). See [Playground](#playground-13).

`POST /approvals` body `{ decision: "approve" | "decline", sessionId?, actor?: "senior" | "caretaker" }` → `{ sessionId, decision, reply, pendingApproval, lastApproval }`. Tap Yes / No on the iPhone. Voice yes/no uses the same resolver. Actor `model` is rejected.

When `MODEL_API_KEY` is set, `apps/api/src/harness.ts` asks ChatGPT (Chat Completions, default `gpt-4o-mini`, optional `MODEL_NAME`) to propose Kasama tools. Each call runs through `invokeTool` as `actor: "model"`. If the key is missing or OpenAI throws, `apps/api/src/conversation.ts` uses the original rules-based turn. Composio is not on this loop.

Rules the harness keeps:

- Every tool call goes through `invokeTool`, so policy and audit apply (`get_appointment`, `find_ride_options`). `book_ride` from the model is denied (`confirmation_required`) — not a failure. `notify_caretaker` without a human token is an automatic draft (`preview`, not sent) and still opens `pendingApproval` for send. `save_medication_reminder` and `save_hospital_visit` also wait for a human yes; they are not prescription changes or live EHR. A model token cannot send or self-approve (`model_cannot_self_approve`). The first "yes" on a ride plan asks "The Uber is $24.50. Should I book it?" A second human yes, or `POST /approvals`, books as `senior` with a token. "No" logs `declined_by_human` and does not execute.
- At most `MAX_CLARIFICATIONS_PER_REQUEST` (1) clarifying question per request. At most `MAX_TOOL_ROUNDS_PER_TURN` (4) ChatGPT tool rounds; hitting the cap is a `handoff`.
- `plan.steps` lists tools run this turn (`ok` / `denied` / `failed`). `failure` is `retry` or `handoff` when a tool actually failed — never a fake booking.
- Session memory: `sessionView.conversation` = `{ chats, activeChatId, turns, activeRequest, clarificationsAsked, plan, failure }`. `turns` is the active chat. History lists `chats` newest-first with `chatTitleForIntent` labels. Maria can say "yes" on the next turn without restating the appointment.

`POST /speech/transcribe` — multipart `file` (m4a) → `{ transcript }` via ElevenLabs Scribe (`apps/api/src/speech.ts`, `ELEVENLABS_API_KEY`). `501 { error: "stt_not_configured" }` when no key; `502` on provider failure.

`POST /speech/speak` — `{ text }` → MPEG audio of Kasama via ElevenLabs TTS (same key; optional `ELEVENLABS_VOICE_ID`, default Sarah / `EXAVITQu4vr4xnSDxMaL`). Speed comes from Maria's `speaksSlowly` preference (`0.88`, slower than ElevenLabs default). `501 { error: "tts_not_configured" }` when no key. The iOS app plays the clip with `expo-audio` and falls back to `expo-speech` at `0.92` from the same flag. When `repeatsConfirmations` is on, a `book_ride` checkpoint is spoken twice; the on-screen prompt stays the single `$24.50` sentence. Keys never reach the app. The ElevenLabs key needs **Speech to Text** and **Text to Speech**.

### Composio (Gmail)

Live provider tools go through Composio Platform sessions (`apps/api/src/composio.ts`), not a parallel agent. Identity is Maria's existing id (`senior_maria`). The SDK reads `COMPOSIO_API_KEY` from the environment.

- `POST /composio/connect` — create or resume a session and return a Gmail Connect Link when the account is not connected
- `POST /composio/execute` — `session.execute`. Default remains `GMAIL_GET_PROFILE` (`user_id: "me"`). Pass `toolSlug: "GMAIL_CREATE_EMAIL_DRAFT"` or `GMAIL_SEND_EMAIL` (documented at https://docs.composio.dev/toolkits/gmail.md). Omitted caretaker fields fill `GMAIL_CARETAKER_DRAFT_ARGUMENTS` / `GMAIL_CARETAKER_SEND_ARGUMENTS` (`juleselvandrade@gmail.com`). Successful drafts always include `data.draft_id` (copied from Composio's `id` when needed). `GMAIL_SEND_DRAFT` is rejected. `409` + Connect Link if Gmail is not authorized

Calendar stays seeded; Uber uses the controlled provider. `notify_caretaker` drafts locally without a token and never calls Gmail for previews. After a human yes, it sends through Composio's `GMAIL_SEND_EMAIL` to `juleselvandrade@gmail.com` with `familyEmailCopy` — a Jules-addressed HTML report (`is_html: true`, headers and tables) from Maria's seed (reason for the note, appointment, saved tasks, wearable facts, worth-reviewing language, never a diagnosis); missing configuration or authorization falls back to the CI-safe mock. The same policy gate remains in force.

## Shared contracts

- `packages/shared/src/tools.ts` — tool names, inputs, results (Uber products: `UberX`, `WAV`; local `save_medication_reminder` / `save_hospital_visit`). `notify_caretaker` inputs and draft results carry optional recipient identity fields. Hospital `timeLabel` is speakable (`Thursday at 10:00 AM`); ISO stamps from ChatGPT are formatted before the card.
- `packages/shared/src/time-label.ts` — ISO → weekday + clock for hospital times
- `packages/shared/src/policy.ts` — `POLICY_TABLE`, `evaluateAction`, `evaluateToolCall`
- `packages/shared/src/audit.ts` — event shape + `createAuditLog()`
- `packages/shared/src/invoke.ts` — HTTP request schema
- `packages/shared/src/approval.ts` — pending/last approval, `POST /approvals` body/response, $24.50 demo prompt helpers
- `packages/shared/src/session.ts` — session view Zod types (`sessionViewSchema`, `DEFAULT_SESSION_ID`); includes `conversation`, `pendingApproval`, `lastApproval`, `lastRideOptions`, `lastMedicationReminder`, `lastHospitalVisit`, `tasks`, `caretakerNarrative`
- `packages/shared/src/narrative.ts` — caretaker activity copy from a `SessionView` (`generateCaretakerNarrative`). Ride beats mention the appointment, Uber WAV $24.50, and that nothing is booked until a human yes; a decline says the Uber was not booked. Never a diagnosis.
- `packages/shared/src/conversation.ts` — voice loop contracts: turn request/response, chats (`conversationChatSchema`, topic titles, `startNewChat`), `activeRequest`, `plan`, `failure`, `pendingApproval`, `MAX_CLARIFICATIONS_PER_REQUEST`, `MAX_TOOL_ROUNDS_PER_TURN`, transcribe response
- `packages/shared/src/composio.ts` — Composio connect/execute schemas; default toolkit `gmail`, default tool `GMAIL_GET_PROFILE`, optional `GMAIL_CREATE_EMAIL_DRAFT` / `GMAIL_SEND_EMAIL`; `normalizeComposioExecuteData` copies a Gmail draft `id` onto `draft_id`
- `packages/shared/src/playground.ts` — text playground (`#13`): `POST /playground` request/response, `PLAYGROUND_DEFAULT_SESSION_ID`, `PLAYGROUND_DEMO_TRANSCRIPT`, `MAX_PLAYGROUND_ADVANCE_TURNS`
- `packages/shared/src/seed.ts` — Maria's demo fixtures: profile, tomorrow's doctor appointment (+ `computeArrivalTarget`), caretaker preferences/escalation rules, wearable trend, prior-request/confusion markers, care-aware usage and response times, dashboard viewer (Margaret), family contacts (James Alvarez, Jules, Sarah, Emily), and the seeded Maria ↔ Kasama ride turns. `getMariaSeedBundle()` is the single entry point for the caretaker dashboard (`#9`) and care-aware view (`#10`).
- `packages/shared/src/family.ts` — resolves spoken family names to display contacts (James Alvarez by default; Jules / Sarah / Emily also match) while pinning delivery to `COMPOSIO_CARETAKER_RECIPIENT` (Jules's Gmail).
- `packages/shared/src/family-report.ts` — `familyEmailCopy` builds the HTML Gmail subject/body Jules receives after a human yes (tables, headers, `is_html: true`).
- `packages/shared/src/communication.ts` — maps `communicationPreferences` to ElevenLabs speed, device TTS rate, spoken confirmation repeats, and the harness simple-language line (`#31`). No in-app toggle.
- `packages/shared/src/demo-session.ts` — iOS `default` session start state: appointment, UberX + WAV options, seeded WAV booking (`UBER-WAV-SEED`), senior approval, Lisinopril reminder, St. Mary's visit, Tasks items, and `conversation.chats` (hospital visit, medication reminder, doctor ride). Senior Chat history, caretaker activity, and Tasks all read this from `GET /sessions/default` — do not add a second transcript store.
- `packages/shared/src/caretaker-dashboard.ts` — caretaker screen projection from `SessionView` + seed (overview status, care notes, appointment, selected ride, consent rows, FAMILY UPDATE draft/sent/not sent, activity).
- `packages/shared/src/care-aware.ts` — care-aware view (`#10`) projection from Maria's seed (usage, response times, repeated questions, worth-reviewing quote, and quick actions). Notify daughter opens a family update; it does not claim that nothing was messaged.
- `packages/shared/src/index.ts` — re-exports

If you add a tool, add it to `tools.ts`, map it in `TOOL_ACTIONS`, handle it in `apps/api/src/invoke-tool.ts`, project any session fields in `apps/api/src/session-store.ts`, add tests, and update this file.

`save_medication_reminder` and `save_hospital_visit` are local-only: a reminder becomes a Tasks item (first confirm hits a stub health-sync miss; Confirm on the error saves on-device). Hospital confirm stores St. Mary's details. Neither is live EHR, and neither is `change_medication`.

Composio session tools (`GMAIL_GET_PROFILE`, `GMAIL_CREATE_EMAIL_DRAFT`, `GMAIL_SEND_EMAIL`) live on `POST /composio/*`; human-approved `notify_caretaker` also invokes `GMAIL_SEND_EMAIL` through `invokeTool` after policy approval. Conversation previews still cannot send.

## Uber

Booking is through Uber. `find_ride_options` / `book_ride` go through `apps/api/src/uber-provider.ts` (`UberProvider.findOptions` / `book`). This issue ships a controlled in-process implementation: two products (UberX ~$18, WAV ~$24.50), speakable confirmation ids (`UBER-WAV-0001`), and `success: true` only when the provider can re-read the booking it just wrote. Policy still requires a human token to book.

Live Uber (official API or Browserbase) is issue `#14`. A later adapter implements the same `UberProvider` interface. Until then the product names and confirmation still read as Uber, not a generic cab.

## What is not built yet

Live Uber (`#14`). Care-aware view (`#10`) is built: tapping Care notes on the caretaker dashboard opens usage, repeated questions, response time, and a worth-reviewing quote (never a diagnosis); **Notify daughter** uses `notify_caretaker`. Caretaker dashboard (`#9`) is built: designed family screen polls `GET /sessions/:sessionId` and shows a **FAMILY UPDATE** card for draft / sent / not sent. Session HTTP (`#18`) is built. Agent playground (`#13`) is built: `POST /playground` or `pnpm playground`. Ride-option cards (`#8`) are built on Chat (UberX + WAV from `lastRideOptions`). Medication-reminder, health-sync error, and hospital-scheduling cards (`#41`) are built on an open Chat thread; confirmed items appear on Tasks. Chat history (`#45`) is the Chat tab list of titled threads on `conversation.chats`. Family email (`#11`) is built: Senior Chat **MESSAGE TO**, caretaker Overview **FAMILY UPDATE**, care-aware Notify daughter on the same tool. `notify_caretaker` (`#16`) drafts on `POST /tools/notify_caretaker` and sends through Composio Gmail after a human yes, with the CI-safe fallback described above.

Voice loop (`#4`), harness (`#5`), and approval checkpoints (`#6`) are built: designed senior screen, on-device recording + speech, `POST /conversation/turn`, `POST /approvals`, `POST /speech/transcribe`. Maria's communication preferences (`#31`) drive TTS speed, device fallback rate, spoken ride-checkpoint repeats, and the harness simple-language line. Live speech-to-text needs `ELEVENLABS_API_KEY` in `apps/api/.env`; without it the screen falls back to typing. `notify_caretaker` previews locally and sends through Composio Gmail only after human approval, with an unconfigured/needs-auth mock fallback. `find_ride_options` / `book_ride` use the controlled Uber provider (UberX + WAV, $24.50 checkpoint price); live execute against Uber is still `#14`.

Composio Platform sessions are on `POST /composio/connect` and `POST /composio/execute` (Gmail / `GMAIL_GET_PROFILE` default; `GMAIL_CREATE_EMAIL_DRAFT` or `GMAIL_SEND_EMAIL` when asked) for `senior_maria`. Human-approved `notify_caretaker` uses the same send tool; its preview remains local.

Maria's seed data (`#2`) is built: `get_appointment` still uses Maria's seed (live calendar is out of scope; Composio later if cheap).

## Keeping architecture context shared

When this diagram, a package, a route, or a tool changes, update **this file** and [AGENTS.md](AGENTS.md). Do not start a second architecture doc.
