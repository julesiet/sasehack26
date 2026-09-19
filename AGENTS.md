# AGENTS.md

Operating instructions for coding agents (Cursor, Claude, Copilot, humans pairing on this repo).

## Naming

**Kasama** is the product AI. In UI, voice, issues, and docs, call it Kasama — not “the AI”, “the assistant”, or “the agent”.

In this file, “coding agent” means someone working on the codebase. Do not call Kasama “the agent” in user-facing copy.

## Shared context is mandatory

All agents must use the **same** project context. Do not invent a parallel story of the repo.

Canonical files (edit these in place; do not replace them with new names):

| File | What it is |
|---|---|
| [AGENTS.md](AGENTS.md) | How to work here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System shape, packages, APIs |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Where new code and docs go |
| [docs/SAFETY.md](docs/SAFETY.md) | Permission policy (must match `packages/shared/src/policy.ts`) |
| [README.md](README.md) | How a human runs the app |

If you change stack, folders, tools, routes, policy, run commands, or demo scope, **update these same files in the same PR**. Do not leave the new fact only in a commit message, issue comment, or a new markdown file.

Do **not** create extra `NOTES.md`, `CONTEXT.md`, `AGENT.md`, or per-agent READMEs. Add a section here or in `ARCHITECTURE.md` instead.

Code contracts live in `packages/shared`. Docs describe them; they do not fork them.

## Product

Kasama is a voice-first, care-aware iOS product. Seniors talk to Kasama; families see explainable activity. Ride booking is **Uber only**.

iOS only. Android is out of scope. No Next.js / web client for MVP.

## Repo

```text
apps/mobile          Expo / React Native iOS
apps/api             Hono on Node — http://localhost:3001
packages/shared      Zod tools, policy, audit types
```

pnpm workspaces + Turborepo. Node 20. Package manager `pnpm@9.15.9`.

## Commands

```sh
pnpm install
pnpm dev              # API + Expo LAN (QR for Expo Go)
pnpm dev:api          # API only
pnpm start            # Expo Go QR only (own terminal)
pnpm ios              # Expo → iOS Simulator (own terminal)
pnpm typecheck
pnpm test
```

GitHub Actions on pull requests and `main` runs `pnpm typecheck` and `pnpm test` (`.github/workflows/ci.yml`). No `MODEL_API_KEY`, `ELEVENLABS_API_KEY`, or `COMPOSIO_API_KEY` is required.

`pnpm dev`, `pnpm start`, and `pnpm ios` are long-running. Do not chain them in one terminal. Port 3001 / 8081 in use means that process is already up — do not start a second copy.

There is no product website. `http://localhost:3001` is the API. The app is Expo Go (`pnpm start` / `pnpm dev`) or the Simulator (`pnpm ios`). For a phone, put this Mac's LAN IP in `apps/mobile/.env` as `EXPO_PUBLIC_API_URL=http://<ip>:3001` (`ipconfig getifaddr en0`) so the QR is not localhost. Restart Expo after changing `.env`.

## Current API

- `GET /` — service hint
- `GET /health` — `{ ok: true, service: "kasama-api" }`
- `POST /tools/:name` — validate → policy → audit → session projection → stub execute
- `GET /sessions/:sessionId` — in-memory session view (current request, pending approval, last approval, last Uber options, appointment, last Uber booking, caretaker activity, care signal, session events)
- `GET /audit` — `{ events: [...] }` all process-local events; optional `?sessionId=` filters. Cleared on process restart
- `POST /conversation/turn` — `{ transcript, sessionId? }` → Kasama's reply + `kind` + `plan` + `failure` + `pendingApproval`. ChatGPT plans when `MODEL_API_KEY` is set; otherwise the rules-based turn. Every tool still goes through policy + audit. ChatGPT is never allowed to book or send. A spoken yes after a ride plan opens the $24.50 checkpoint; a second yes (or tap) books as `senior`.
- `POST /approvals` — `{ decision: "approve" | "decline", sessionId?, actor?: "senior" | "caretaker" }` → resolve the pending checkpoint. Same policy + audit as tools. Model actors are rejected.
- `POST /speech/transcribe` — multipart `file` → `{ transcript }` via ElevenLabs (needs `ELEVENLABS_API_KEY` in `apps/api/.env`; `501` otherwise)
- `POST /speech/speak` — `{ text }` → MPEG audio of Kasama (same key, plus Text to Speech on the key; `501` otherwise, device falls back to iOS speech)
- `POST /composio/connect` — `{ userId?, toolkit?, wait? }` → Gmail Connect Link or `{ connected: true }`. Session user is `senior_maria` (`MARIA_PROFILE.id`). Needs `COMPOSIO_API_KEY` in `apps/api/.env`; `501` otherwise
- `POST /composio/execute` — `{ userId?, toolSlug?, arguments? }` → session tool result + `logId`. Defaults to `GMAIL_GET_PROFILE`. Pass `GMAIL_CREATE_EMAIL_DRAFT` for a caretaker draft or `GMAIL_SEND_EMAIL` to send to `juleselvandrade@gmail.com`. `409` with a Connect Link if Gmail is not connected. `GMAIL_SEND_DRAFT` is rejected. Not wired into `notify_caretaker` or conversation.

Omitted `sessionId` on a tool call is stored as `default`. Senior and caretaker clients poll the same `sessionId`.

Tools: `get_appointment`, `find_ride_options`, `book_ride`, `notify_caretaker`. After a human yes, `book_ride` returns `status: "booked"` and a confirmation id, or `success: false` if the confirmation cannot be proven. `notify_caretaker` drafts automatically (`preview`, not sent). Send needs a human `approvalToken` (actor ≠ `model`) and currently mocks email/SMS.

Calendar is **seeded** (`get_appointment` for Maria's tomorrow appointment). Uber search and book use a controlled in-process provider (`apps/api/src/uber-provider.ts`). Policy and audit are real. Live Uber is `#14`.

## Mobile

Expo Go only (`pnpm start` or `pnpm ios`). Add only Expo Go–compatible packages; no native speech-to-text modules and no `expo prebuild`. Speech-to-text and Kasama's voice run on the API via ElevenLabs. The device falls back to `expo-speech` if TTS is not configured.

Senior screen design tokens live in `apps/mobile/src/theme.ts`. Conversation phases and what each looks like are in [ARCHITECTURE.md](ARCHITECTURE.md#senior-conversation-screen-4). Senior tabs: Home (sun welcome), Chat (last started conversation), Tasks (empty). Active tab is sun orange. On Home the compact tab bar is 80% opaque over the sun. Confirmation is a descriptive Cancel / Confirm card that only appears for a pending (or just-finished) decision. Tap targets ≥ 68pt on senior actions.

## Safety (non-negotiable)

Kasama may request tools. The harness decides. Encode policy in `packages/shared/src/policy.ts`, not comments.

- Book Uber / send message / spend money → human `approvalToken`, actor ≠ `model`
- Model cannot self-approve even with a token
- No diagnosis. No unsupervised medication changes
- Care language is “worth reviewing,” never a medical conclusion

See [docs/SAFETY.md](docs/SAFETY.md).

## Issues

Repo: [julesiet/sasehack26](https://github.com/julesiet/sasehack26).

- `can-start-now` + `no-design-needed` — safe to implement
- `blocked:design` / `needs-design` — do not build designed UI
- `design-ready` — mockups landed; UI work may start
- Designers start at [#20](https://github.com/julesiet/sasehack26/issues/20)
- Design done comment: `Design done — unblocks #N` plus flip `blocked:design` → `design-ready`

Do not implement diagnosis, full EHR, unsupervised payments, or Android.

## Git

- Only commit when the user asks
- Do not push unless asked
- Do not switch the user’s branch unless they asked
- Do not close GitHub issues unless asked

## Definition of done for agent work

1. Code matches existing layout (`docs/CONVENTIONS.md`)
2. Shared types/policy updated in `packages/shared` if you touched contracts
3. Canonical docs updated if behavior or structure changed
4. `pnpm typecheck` and `pnpm test` pass
