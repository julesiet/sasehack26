# Code Structure — Kasama

## Repository Layout

```
sasehack26/                      (root: package.json "kasama", private, pnpm@9.15.9)
├── README.md, ARCHITECTURE.md, AGENTS.md   — canonical, cross-referenced docs (single source of truth)
├── docs/
│   ├── CONVENTIONS.md            — coding conventions
│   └── SAFETY.md                 — normative safety/policy spec ("if code and docs disagree, fix both")
├── package.json, pnpm-workspace.yaml, turbo.json, tsconfig.json, .npmrc, .env.example
├── packages/
│   └── shared/                   — @kasama/shared (contracts library)
├── apps/
│   ├── api/                      — @kasama/api (Hono HTTP service)
│   └── mobile/                   — @kasama/mobile (Expo/React Native client)
├── .agents/, .cursor/rules/       — coding-agent tool configuration (not product code)
└── aidlc/                        — AI-DLC workflow bookkeeping (this framework; not product code)
```

Monorepo orchestration is **pnpm workspaces** (`apps/*`, `packages/*`) + **Turborepo** for the task graph (`build`/`typecheck`/`test`/`dev` etc.). Full build-system detail is in `technology-stack.md`; this document covers module organization and code patterns within each package.

## Package Organization

### `packages/shared/src/` — `@kasama/shared`

Nine source files, all read in full, each owning one contract domain:

| File | Responsibility |
|---|---|
| `tools.ts` | Zod input/result schemas for the four Kasama tools (`get_appointment`, `find_ride_options`, `book_ride`, `notify_caretaker`) |
| `policy.ts` | Policy engine: `evaluateAction` / `evaluateToolCall`, including the `model_cannot_self_approve` rule |
| `audit.ts` | Audit event shape (schema + type) |
| `session.ts` | `SessionView` projection types |
| `invoke.ts` | `invokeToolRequestSchema` and related tool-invocation contract types |
| `conversation.ts` | Conversation/voice-loop turn request/response contracts, shared by both API conversation engines |
| `composio.ts` | Composio connect/execute contract types |
| `seed.ts` | Demo seed-data fixtures (the "Maria" persona's appointments/rides) |
| `index.ts` | Package entry point — re-exports the above |

**Pattern**: this package is pure types + Zod schemas + static fixtures — no side effects, no I/O, no framework dependency (only `zod`). It is the single place cross-boundary shapes are defined, consistent with the "contracts-first" architectural decision in `architecture.md`.

### `apps/api/src/` — `@kasama/api`

Eleven source files, all read in full:

| File | Responsibility |
|---|---|
| `index.ts` | Process entry point — starts the Hono server via `@hono/node-server` |
| `app.ts` | Route table — all 11 HTTP routes registered here (see `api-documentation.md`) |
| `invoke-tool.ts` | `invokeTool` orchestration: validate → `evaluateToolCall` (policy) → `executeStub` → audit append → session update |
| `session-store.ts` | In-memory `SessionView` store (`Map`-backed), including clarification-budget logic |
| `audit-log.ts` | In-memory audit event log (array-backed), queryable by `sessionId` |
| `load-env.ts` | Hand-rolled `.env` file parser (loads env vars without overwriting existing `process.env`) |
| `conversation.ts` | Rules-based conversation-turn engine (`decide()`) — regex/keyword-driven |
| `harness.ts` | ChatGPT-driven conversation-turn engine (`runHarnessTurn()`) — system prompt + tool-calling loop |
| `model.ts` | Raw `fetch` client for OpenAI Chat Completions |
| `speech.ts` | ElevenLabs client: speech-to-text (`transcribe`) and text-to-speech (`speak`) |
| `composio.ts` | Composio Platform SDK client: session connect/execute for Gmail |

**Pattern**: a thin route layer (`app.ts`) delegates to single-responsibility modules; nothing in this layer talks to an external provider directly except through the dedicated client modules (`model.ts`, `speech.ts`, `composio.ts`). All tool-invocation routes converge on `invoke-tool.ts` (see `architecture.md` → Key Design Decisions).

### `apps/mobile/` — `@kasama/mobile`

Deeply analyzed:

| File | Responsibility |
|---|---|
| `App.tsx` | App shell / navigation root |
| `src/lib/api.ts` | HTTP client wrapping calls to `@kasama/api` |
| `src/hooks/useKasamaConversation.ts` | Voice-loop state machine (`idle/listening/thinking/speaking/clarify/micDenied/error`) — the client-side orchestration for the conversation-turn + speech endpoints |
| `src/theme.ts` | Centralized design tokens (per `docs/CONVENTIONS.md` — no CSS-in-JS/UI kit, plain `StyleSheet` + this token module) |
| `src/screens/SeniorScreen.tsx` | Primary voice-first senior-facing screen |
| `src/screens/CaretakerScreen.tsx` | Caretaker-facing placeholder screen |
| `src/screens/HomeScreen.tsx` | Dev-only navigation/testing screen |
| `src/components/ComposerPill.tsx` | Voice-input control component |

Skimmed only (line-counted, not read): `src/components/OverflowMenu.tsx`, `SunBowl.tsx`, `SunOrb.tsx`, `Waveform.tsx` — presentational sub-components of the voice UI per `ARCHITECTURE.md`. `assets/` (icon/image binaries) not applicable to code reading.

**Pattern**: screens are thin presentational shells; the state machine and API calls are isolated in a hook + client module, matching the "no business logic in the mobile client" decision in `architecture.md`.

## File Classification Summary

| Class | Count / Location | Notes |
|---|---|---|
| Contract/schema source | 9 files, `packages/shared/src/` | Zod schemas + types, zero framework deps |
| Service source (routes/logic/clients) | 11 files, `apps/api/src/` | Hono routes + orchestration + provider clients |
| Client source (screens/hooks/components) | 8 files deeply analyzed + 4 skimmed, `apps/mobile/` | Expo/React Native, thin over `@kasama/shared` + API client |
| Test source | 12 files, 1,781 lines, co-located (`*.test.ts`) | `apps/api/src` (6 files) + `packages/shared/src` (6 files); inventoried by name/line-count, not read line-by-line (see `reverse-engineering-timestamp.md` → Scope of Analysis) |
| Documentation | 5 canonical root/docs files | `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/SAFETY.md` — see `code-quality-assessment.md` |
| Config (build/tooling) | root + per-package `package.json`/`tsconfig.json`/`vitest.config.ts`, `pnpm-workspace.yaml`, `turbo.json`, `.npmrc`, `.env.example`, `app.json`, `metro.config.js` | See `technology-stack.md` |
| Out of scope for product-code analysis | `.agents/`, `.cursor/rules/`, `.claude/`, `aidlc/`, `.turbo/`, `.expo/`, `node_modules/` | Tool config, framework bookkeeping, caches, dependency internals — noted present, not analyzed as product code |

## Code Patterns Observed

- **Contracts-first / single source of truth**: every cross-boundary payload (tool I/O, policy decisions, audit events, session views, conversation turns, Composio calls) is a Zod schema in `@kasama/shared`, imported (not redefined) by both `apps/api` and `apps/mobile`.
- **Convergent tool pipeline**: both conversation engines (`conversation.ts`, `harness.ts`) call the same `invokeTool` function rather than executing tool logic themselves — see the Interaction Diagrams in `architecture.md`.
- **Explicit stubbing over fabrication**: stub implementations (`executeStub` for `find_ride_options`/`book_ride`) return empty/`not_implemented` results rather than fake success, a convention stated directly in `docs/CONVENTIONS.md`.
- **Tests co-located with source** (`*.test.ts` beside the file under test), not in a separate `tests/` tree — a stated repo convention.
- **Env loading duplicated** rather than shared: `apps/api/src/load-env.ts` and `apps/mobile/scripts/start-expo.cjs` each hand-roll near-identical `.env` parsing — see `code-quality-assessment.md` → Technical Debt.
- **Design tokens centralized, no UI kit**: `apps/mobile/src/theme.ts` is the single styling source of truth for the mobile client, consistent with `docs/CONVENTIONS.md`.
