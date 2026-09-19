# API Documentation — Kasama

## Overview

Kasama exposes one HTTP REST API (`apps/api`, Hono framework) with 11 routes, plus a formal internal "tool" surface (the four Kasama tools) that is reachable both directly (`POST /tools/:name`) and indirectly (via either conversation engine). All request/response shapes are defined as Zod schemas in `@kasama/shared` and imported by the API — see `code-structure.md` → `packages/shared/src/`. Component ownership of each route/module is catalogued in `component-inventory.md`; this document is the contract-level reference.

CORS is wide open (`origin: "*"`, via `hono/cors`) on all routes — appropriate for the current LAN-only demo scope, flagged as a hardening item in `architecture.md` and `code-quality-assessment.md`.

## HTTP REST API — `apps/api/src/app.ts`

### `GET /`
Service/route hint index. No auth, no body.

### `GET /health`
Liveness check. Returns `{ ok: true, service: "kasama-api" }`.

### `GET /audit`
Returns `{ events: AuditEvent[] }` — the full in-memory audit trail (cleared on process restart). Optional `?sessionId=` query param filters to one session's events.

### `GET /sessions/:sessionId`
Returns a `SessionView` projection (in-memory). **Unknown `sessionId` values return an empty `200` view, not a `404`** — a deliberate contract choice worth preserving in any client code that calls this endpoint.

### `POST /tools/:name`
Generic tool-invocation endpoint. `:name` ∈ `{ get_appointment, find_ride_options, book_ride, notify_caretaker }`.
- Request body validated against `invokeToolRequestSchema` (envelope: actor, tool name, input) plus the specific tool's Zod input schema from `packages/shared/src/tools.ts`.
- Routes through: `evaluateToolCall` (policy, `@kasama/shared`) → `executeStub` (currently stubbed for all four tools, `apps/api/src/invoke-tool.ts`) → `auditLog.append` → `sessionStore.applyToolEvent`.
- This is the canonical entry point for the internal tool surface — see Internal Tool Surface below and the Tool Invocation sequence diagram in `architecture.md`.

### `POST /conversation/turn`
Voice-loop conversation turn. Body validated against `conversationTurnRequestSchema` (`@kasama/shared`).
- Delegates to the ChatGPT harness (`apps/api/src/harness.ts`) when `MODEL_API_KEY` is set (or a `complete` function is injected, e.g. for tests); otherwise delegates to the rules-based engine (`apps/api/src/conversation.ts`).
- **Both paths call back into `invokeTool` for every actual tool call** — see the Conversation Turn sequence diagram in `architecture.md`.

### `POST /speech/transcribe`
Multipart `file` upload → ElevenLabs Scribe STT (`apps/api/src/speech.ts`) → `{ transcript }`.
- `501` if `ELEVENLABS_API_KEY` is unset.
- `502` on provider failure.

### `POST /speech/speak`
Body `{ text }` → ElevenLabs TTS (model `eleven_turbo_v2_5`, default voice `EXAVITQu4vr4xnSDxMaL`) → raw MPEG bytes.
- Same `501`/`502` pattern as `/speech/transcribe`.

### `POST /composio/connect`
Create/resume a Composio session for a user (default `senior_maria`). Returns a Gmail Connect Link, or `{ connected: true }` if already authorized.
- `501` if `COMPOSIO_API_KEY` is unset.
- **Not routed through the tool policy/audit pipeline** — see Internal Tool Surface note below and `code-quality-assessment.md`.

### `POST /composio/execute`
Execute a Composio session tool (default `GMAIL_GET_PROFILE`).
- `409` + Connect Link if Gmail is not yet authorized for the session.
- `501` if not configured.
- Same policy/audit bypass caveat as `/composio/connect`.

## Internal Tool Surface (formal, non-HTTP)

Four Kasama tools are defined once, as Zod input/result schemas, in `packages/shared/src/tools.ts`, and dispatched through `apps/api/src/invoke-tool.ts`'s `executeStub`:

| Tool | Kind | Current Implementation |
|---|---|---|
| `get_appointment` | read | Returns seeded appointment data (`packages/shared/src/seed.ts`) |
| `find_ride_options` | read | Stub — always returns an empty options array |
| `book_ride` | write | Stub — always returns `status: "not_implemented"` (never fabricates a booking, per `docs/CONVENTIONS.md`) |
| `notify_caretaker` | write | Stub |

All four tools pass through the **real** policy engine and **real** audit log regardless of stub status — this is the one pipeline every tool call (from either conversation engine, or a direct `POST /tools/:name` call) is required to flow through. Per `AGENTS.md`, adding a new tool means: add it to `tools.ts`, map it in `TOOL_ACTIONS`, and handle it in `invoke-tool.ts` — extending this same pipeline, not introducing a parallel one.

**Known gap**: `POST /composio/*` executes real Gmail actions through the Composio SDK directly, bypassing `invokeTool`/`evaluateToolCall`/`auditLog` entirely — this means Composio-executed actions currently have no policy gate and no audit trail, unlike every other action surface in the system. This is documented by the repo itself (`ARCHITECTURE.md`) as a known gap, not a silent one. See `code-quality-assessment.md` → Technical Debt Signals.

## External APIs Consumed

See `dependencies.md` for the full external-dependency list including auth/env-var requirements; summarized here as API contracts:

- **OpenAI Chat Completions** (`apps/api/src/model.ts`) — `POST https://api.openai.com/v1/chat/completions`, function/tool-calling with the 4 Kasama tool schemas, default model `gpt-4o-mini`.
- **ElevenLabs Speech-to-Text** — `POST https://api.elevenlabs.io/v1/speech-to-text`, model `scribe_v1`.
- **ElevenLabs Text-to-Speech** — `POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`, model `eleven_turbo_v2_5`.
- **Composio Platform SDK** (`@composio/core`, `apps/api/src/composio.ts`) — session-based tool execution, currently wired only to the Gmail toolkit / `GMAIL_GET_PROFILE` action.

## Mobile Client Consumption

`apps/mobile/src/lib/api.ts` is the sole HTTP client used by the mobile app; `apps/mobile/src/hooks/useKasamaConversation.ts` is the sole caller that drives the conversation-turn + speech-transcribe/speak round trip described in `architecture.md` → Data Flow. No other module in `apps/mobile` talks to the API directly (see `component-inventory.md`).
