# Component Inventory — Kasama

This is the owning artifact for component responsibilities and dependencies. Other artifacts reference components by the exact headings below rather than repeating descriptions.

## @kasama/shared

**Location**: `packages/shared`. **Type**: library (contracts). **Language**: TypeScript. **Depends on**: `zod` only (no internal deps — leaf package). **Depended on by**: `@kasama/api`, `@kasama/mobile` (both via `workspace:*`).

Single source of truth for every cross-boundary data shape in the system: tool contracts, policy engine, audit event shape, session-view types, conversation/voice-loop contracts, Composio connect/execute contracts, demo seed data. Consumed as raw TypeScript source (no build/emit step).

### Tool Contracts (tools.ts)
Zod input/result schemas for the four Kasama tools (`get_appointment`, `find_ride_options`, `book_ride`, `notify_caretaker`). Depended on by `apps/api/src/invoke-tool.ts` and both conversation engines.

### Policy Engine (policy.ts)
`evaluateAction` / `evaluateToolCall` — the policy decision logic, including the `model_cannot_self_approve` rule. Depended on by `apps/api/src/invoke-tool.ts`.

### Audit Event Schema (audit.ts)
Shape/type for audit log entries. Depended on by `apps/api/src/audit-log.ts` and `invoke-tool.ts`.

### Session View Types (session.ts)
`SessionView` projection types. Depended on by `apps/api/src/session-store.ts`.

### Invoke Contracts (invoke.ts)
`invokeToolRequestSchema` and related envelope types for `POST /tools/:name`. Depended on by `apps/api/src/app.ts` and `invoke-tool.ts`.

### Conversation Contracts (conversation.ts — shared)
`conversationTurnRequestSchema` and related turn request/response types, shared by both API conversation engines. Depended on by `apps/api/src/app.ts`, `apps/api/src/conversation.ts`, `apps/api/src/harness.ts`.

### Composio Contracts (composio.ts — shared)
Types for Composio connect/execute request/response payloads. Depended on by `apps/api/src/composio.ts`.

### Demo Seed Data (seed.ts)
Fixture data for the "Maria" demo persona (appointments, rides). Depended on by `get_appointment`'s stub implementation.

### Package Entry Point (index.ts)
Re-exports all of the above for `@kasama/api` and `@kasama/mobile` to import as one package.

---

## @kasama/api

**Location**: `apps/api`. **Type**: service (HTTP API). **Language**: TypeScript/Node (run via `tsx`, no bundling step in dev). **Depends on**: `@kasama/shared` (`workspace:*`), Hono, `@hono/node-server`, `@composio/core`. **Depended on by**: `@kasama/mobile` (over HTTP, not a code dependency).

Hono server exposing tool invocation, session polling, audit log, conversation turn (both engines), speech transcribe/speak (ElevenLabs), and Composio Gmail session endpoints. Full route contracts in `api-documentation.md`.

### HTTP Server Entry (index.ts)
Process entry point; starts the Hono server via `@hono/node-server`.

### Route Definitions (app.ts)
All 11 HTTP routes registered here; wide-open CORS via `hono/cors`. See `api-documentation.md` for the full route table.

### Tool Invocation Router (invoke-tool.ts)
`invokeTool` / `executeStub` — validates against Tool Contracts, calls the Policy Engine, executes (currently stubbed for all four tools), appends to Audit Log, updates Session Store. The single choke point every tool call flows through (from `app.ts`, Rules-based Conversation Engine, and ChatGPT Harness alike).

### Session Store (session-store.ts)
In-memory (`Map`-backed) `SessionView` store, including clarification-budget logic. Non-durable — cleared on process restart.

### Audit Log (audit-log.ts)
In-memory (array-backed) audit event log, queryable by `sessionId` via `GET /audit`. Non-durable — cleared on process restart.

### Env Loader (load-env.ts)
Hand-rolled `.env` file parser (loads env vars without overwriting existing `process.env`). Duplicated independently in `apps/mobile/scripts/start-expo.cjs` — see `code-quality-assessment.md`.

### Rules-based Conversation Engine (conversation.ts)
`decide()` — regex/keyword-driven conversation-turn logic (ride proposal construction, appointment-lookup formatting, yes/no detection). Used when no model API key is configured. Calls Tool Invocation Router for tool calls.

### ChatGPT Harness (harness.ts)
`runHarnessTurn()` — system-prompt-driven, ChatGPT-based conversation-turn logic with materially overlapping responsibilities to the Rules-based engine (duplicated regex constants with a case-sensitivity mismatch — see `code-quality-assessment.md`). Calls OpenAI Model Client for completions and Tool Invocation Router for tool calls.

### OpenAI Model Client (model.ts)
Raw `fetch` client for OpenAI Chat Completions (`gpt-4o-mini` default), function/tool-calling with the 4 Kasama tool schemas. Depended on by ChatGPT Harness.

### Speech Service (speech.ts)
ElevenLabs client: `transcribe` (STT, model `scribe_v1`) and `speak` (TTS, model `eleven_turbo_v2_5`). Backs `POST /speech/transcribe` and `POST /speech/speak`.

### Composio Integration (composio.ts — API)
Composio Platform SDK client: session connect/execute for Gmail (`GMAIL_GET_PROFILE`). Backs `POST /composio/connect` and `POST /composio/execute`. **Does not** depend on or route through the Tool Invocation Router / Policy Engine / Audit Log — a known, documented gap (see `architecture.md` and `code-quality-assessment.md`).

---

## @kasama/mobile

**Location**: `apps/mobile`. **Type**: application (mobile client, iOS via Expo). **Language**: TypeScript/React Native. **Depends on**: `@kasama/shared` (`workspace:*`), Expo SDK, React, React Native, `expo-audio`, `expo-file-system`, `expo-linear-gradient`, `expo-speech`, `expo-status-bar`, `@expo/vector-icons`, `react-native-safe-area-context`. **Depended on by**: none (leaf/terminal app).

Voice-first senior conversation screen, caretaker placeholder screen, dev-only home screen; talks to `@kasama/api` over HTTP only. Holds no business logic — all decisions are made server-side.

### App Shell (App.tsx)
Navigation/composition root for the three screens.

### API Client (src/lib/api.ts)
Sole HTTP client used by the mobile app; wraps calls to `@kasama/api` routes. Depended on by Voice Conversation Hook and the screens directly.

### Voice Conversation Hook (useKasamaConversation.ts)
Client-side voice-loop state machine (`idle/listening/thinking/speaking/clarify/micDenied/error`); orchestrates `POST /speech/transcribe` → `POST /conversation/turn` → `POST /speech/speak` via API Client. Zero automated test coverage (see `code-quality-assessment.md`).

### Theme (theme.ts)
Centralized design tokens; single styling source of truth (no CSS-in-JS/UI kit, per `docs/CONVENTIONS.md`).

### Senior Screen (SeniorScreen.tsx)
Primary voice-first UI; composes Composer Pill and the presentational sub-components, driven by Voice Conversation Hook.

### Caretaker Screen (CaretakerScreen.tsx)
Caretaker-facing placeholder screen; consumes API Client directly (session/audit views).

### Home Screen (HomeScreen.tsx)
Dev-only navigation/testing screen; not part of the production user flow.

### Composer Pill (ComposerPill.tsx)
Voice-input trigger control used by Senior Screen.

### Presentational Sub-components (shallow coverage)
`OverflowMenu.tsx`, `SunBowl.tsx`, `SunOrb.tsx`, `Waveform.tsx` — presentational orb/pill sub-components of the voice UI per `ARCHITECTURE.md`. **Only skimmed** (line-counted, not read) in this scan — see `reverse-engineering-timestamp.md` → Scope of Analysis.

---

## Cross-Component Dependency Summary

See `dependencies.md` for the full internal/external dependency listing. In brief: `@kasama/api` and `@kasama/mobile` both depend on `@kasama/shared`; `@kasama/mobile` depends on `@kasama/api` only over HTTP (no shared code beyond `@kasama/shared`); `@kasama/shared` has no internal dependencies (leaf package).
