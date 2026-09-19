# sasehack26 (Kasama) — Reverse Engineering Developer Scan

Repo root: `C:\Users\legas\Documents\GitHub\sasehack26`
Scan type: Full rescan (NO_STORE — first scan, no prior CodeKB for this repo)
Commit at scan time: `4efba49431881d7e466f442b6f7e91e246532f80` (2026-09-19)
Depth: Standard

## Developer Code Scan Results

### Scan Coverage

- **Analyzed deeply**:
  - `./` (repo root: README.md, ARCHITECTURE.md, AGENTS.md, docs/CONVENTIONS.md, docs/SAFETY.md, package.json, pnpm-workspace.yaml, turbo.json, tsconfig.json, .npmrc, .env.example)
  - `packages/shared/src/` (all 9 source files: tools.ts, policy.ts, audit.ts, session.ts, invoke.ts, conversation.ts, composio.ts, seed.ts, index.ts — read in full)
  - `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/vitest.config.ts`
  - `apps/api/src/` (all 11 source files: index.ts, app.ts, invoke-tool.ts, session-store.ts, audit-log.ts, load-env.ts, conversation.ts, harness.ts, model.ts, speech.ts, composio.ts — read in full)
  - `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/vitest.config.ts`
  - `apps/mobile/App.tsx`, `apps/mobile/src/lib/api.ts`, `apps/mobile/src/hooks/useKasamaConversation.ts`, `apps/mobile/src/theme.ts`
  - `apps/mobile/src/screens/SeniorScreen.tsx`, `CaretakerScreen.tsx`, `HomeScreen.tsx` (full)
  - `apps/mobile/src/components/ComposerPill.tsx` (full)
  - `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/metro.config.js`, `apps/mobile/scripts/start-expo.cjs` (partial)
  - Test file inventory and line counts for all `*.test.ts` files (10 files, 1781 lines total) across `apps/api/src` and `packages/shared/src` — enumerated and sized, not individually read line-by-line
  - Repo-level directory listing (2 levels) to confirm full top-level and package-level structure

- **Skimmed only**:
  - `apps/mobile/src/components/OverflowMenu.tsx`, `SunBowl.tsx`, `SunOrb.tsx`, `Waveform.tsx` (counted lines, not read; presentational orb/pill sub-components per ARCHITECTURE.md)
  - `apps/mobile/assets/` (icon/image binaries — not applicable to read)
  - `.agents/`, `.cursor/rules/` (coding-agent tool config directories — noted present, not read)
  - `.claude/` (AI-DLC framework shell itself — explicitly out of scope as product code; this is the framework running the scan)
  - `aidlc/` (AI-DLC's own workflow bookkeeping tree — explicitly excluded from product/package structure per scan instructions)
  - `.turbo/` cache directories, `.expo/` local device cache — build/tool caches, not source
  - `node_modules/` — not scanned (dependency internals out of scope; versions taken from `package.json` manifests instead)
  - Individual test file bodies (`*.test.ts`) — inventoried by name/line-count only; not read line-by-line, since the corresponding implementation files were read in full and the test framework/config is confirmed via `vitest.config.ts`

No repo-root `.github/` directory exists (checked and confirmed absent — no CI workflow files anywhere in the repo).

### Packages Found

- `@kasama/shared` (`packages/shared`) — library — TypeScript — Zod schema/type source of truth: tool contracts, policy engine, audit event shape, session-view types, conversation/voice-loop contracts, Composio connect/execute contracts, Maria's demo seed-data fixtures. Imported by both `apps/api` and `apps/mobile`.
- `@kasama/api` (`apps/api`) — service (HTTP API) — TypeScript / Node — Hono server exposing tool invocation, session polling, audit log, conversation turn (voice loop + ChatGPT harness), speech transcribe/speak (ElevenLabs), and Composio Gmail session endpoints.
- `@kasama/mobile` (`apps/mobile`) — application (mobile client) — TypeScript / React Native (Expo, iOS only) — voice-first senior conversation screen, caretaker placeholder screen, dev-only home screen; talks to `@kasama/api` over HTTP.

Monorepo orchestration: pnpm workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`) + Turborepo (`turbo.json`). Root `package.json` name is `kasama`, private, `packageManager: pnpm@9.15.9`.

### Build System

- **Type**: pnpm workspaces + Turborepo (task graph runner) monorepo. Each package/app has its own `tsc --noEmit` (typecheck) and `vitest run` (test) scripts; `apps/api` runs via `tsx` (no bundling step for dev); `apps/mobile` runs via Expo/Metro bundler (`expo start`, wrapped by a custom Node launcher script).
- **Config Files**:
  - Root: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json` (extends `expo/tsconfig.base`), `.npmrc` (`shamefully-hoist=true`)
  - `apps/api`: `package.json`, `tsconfig.json` (strict, ES2022, bundler resolution, Node types), `vitest.config.ts`
  - `apps/mobile`: `package.json`, `tsconfig.json`, `app.json` (Expo config: iOS bundle id `com.kasama.app`, mic permission plugin `expo-audio`), `metro.config.js` (monorepo-aware watch folders / node_modules resolution)
  - `packages/shared`: `package.json` (type: module, exports `./src/index.ts` directly — no build/emit step, consumed as source), `tsconfig.json`, `vitest.config.ts`
- **Build Dependencies** (workspace graph):
  - `@kasama/api` → depends on `@kasama/shared` (workspace:*)
  - `@kasama/mobile` → depends on `@kasama/shared` (workspace:*)
  - `@kasama/shared` → no internal deps (leaf package; only external `zod`)
  - Turbo task graph: `build`/`typecheck`/`test` declare `dependsOn: ["^build"|"^typecheck"|"^test"]` so `shared` is checked before the two apps that consume it. `dev`/`start`/`ios` are marked `cache: false, persistent: true` (long-running dev servers, correctly excluded from Turbo caching).

### APIs Discovered

- **HTTP REST API** — `apps/api/src/app.ts` (Hono) — 11 routes:
  - `GET /` — service/route hint index
  - `GET /health` — `{ ok: true, service: "kasama-api" }`
  - `GET /audit` — `{ events: AuditEvent[] }`, optional `?sessionId=` filter, in-memory, cleared on restart
  - `GET /sessions/:sessionId` — `SessionView` projection (in-memory; unknown ids return an empty 200 view, not 404)
  - `POST /tools/:name` — generic tool-invocation endpoint; `name` ∈ `{get_appointment, find_ride_options, book_ride, notify_caretaker}`; body validated against `invokeToolRequestSchema` + per-tool Zod input schema; routes through `evaluateToolCall` (policy) → stub `executeStub` → `auditLog.append` → `sessionStore.applyToolEvent`
  - `POST /conversation/turn` — voice-loop turn; body `conversationTurnRequestSchema`; delegates to ChatGPT harness (`harness.ts`) when `MODEL_API_KEY` set (or an injected `complete` dep), else rules-based turn (`conversation.ts`); both paths call back into `invokeTool` for every actual tool call
  - `POST /speech/transcribe` — multipart `file` upload → ElevenLabs Scribe STT → `{ transcript }`; 501 if `ELEVENLABS_API_KEY` unset, 502 on provider failure
  - `POST /speech/speak` — `{ text }` → ElevenLabs TTS → raw MPEG bytes; 501/502 same pattern
  - `POST /composio/connect` — create/resume a Composio session for a user (default `senior_maria`), return Gmail Connect Link or `{connected:true}`; 501 if `COMPOSIO_API_KEY` unset
  - `POST /composio/execute` — execute a Composio session tool (default `GMAIL_GET_PROFILE`); 409 + Connect Link if Gmail not authorized; 501 if not configured
  - CORS: wide-open (`origin: "*"`) via `hono/cors` middleware on all routes
- **Internal "tool" surface** (not HTTP, but a formal internal API): 4 Kasama tools defined once in `packages/shared/src/tools.ts` (Zod input/result schemas) and dispatched through `apps/api/src/invoke-tool.ts`'s `executeStub` — `get_appointment`, `find_ride_options`, `book_ride`, `notify_caretaker`. All are currently stub implementations (no live calendar/Uber/notification integration); they still pass through the real policy engine and real audit log.
- **External APIs consumed**:
  - OpenAI Chat Completions (`apps/api/src/model.ts`) — raw `fetch` to `https://api.openai.com/v1/chat/completions`, function/tool-calling for the 4 Kasama tools, default model `gpt-4o-mini`
  - ElevenLabs Speech-to-Text (`https://api.elevenlabs.io/v1/speech-to-text`, model `scribe_v1`) and Text-to-Speech (`https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`, model `eleven_turbo_v2_5`, default voice `EXAVITQu4vr4xnSDxMaL`) — `apps/api/src/speech.ts`
  - Composio Platform SDK (`@composio/core`, `apps/api/src/composio.ts`) — session-based tool execution, currently wired only to Gmail toolkit / `GMAIL_GET_PROFILE`
  - `BROWSERBASE_API_KEY` / `BROWSERBASE_PROJECT_ID` env vars declared (`.env.example`, `envKeys` in shared) but no Browserbase-calling code found anywhere in the scanned source — reserved/planned for future live-Uber integration (`#14`/`#7` per ARCHITECTURE.md), not yet implemented.

### Frameworks & Libraries

(Versions from each package's `package.json`; workspace-resolved via pnpm.)

- **TypeScript** `^5.8.2` (all packages), strict mode on `apps/api` and `packages/shared` tsconfigs
- **Zod** `^3.24.2` — schema/validation layer, the "source of truth" for all cross-boundary contracts (per `packages/shared`)
- **Hono** `^4.7.5` + `@hono/node-server` `^1.14.1` — API HTTP framework/adapter (`apps/api`)
- **@composio/core** `^0.18.1` — Composio Platform SDK (`apps/api`)
- **vitest** `^3.0.9` — test runner (`apps/api`, `packages/shared`)
- **tsx** `^4.19.3` — TS execution for API dev/start scripts
- **turbo** `^2.5.0` — monorepo task orchestration (root)
- **Expo SDK** `~57.0.24`, **React** `19.2.3`, **React Native** `0.86.3` (`apps/mobile`)
- **expo-audio** `~57.0.5`, **expo-file-system** `~57.0.7`, **expo-linear-gradient** `~57.0.2`, **expo-speech** `~57.0.3`, **expo-status-bar** `~57.0.1`, **@expo/vector-icons** `^15.0.2`, **react-native-safe-area-context** `~5.7.0`
- No CSS-in-JS or UI kit beyond React Native `StyleSheet` — design tokens centralized in `apps/mobile/src/theme.ts` per repo convention (`docs/CONVENTIONS.md`)
- No ORM/database library anywhere — all persistence is in-process (`Map`/array) and explicitly non-durable (audit log and session store both documented as "cleared on process restart")

### Test Coverage

- **Test Directories**: tests are co-located next to source (`*.test.ts` beside the unit under test), not in a separate `tests/` tree — per `docs/CONVENTIONS.md` ("Tests next to the unit").
  - `apps/api/src/`: `app.test.ts` (661 lines — largest test file, full HTTP-route coverage), `composio.test.ts` (147), `conversation.test.ts` (171), `harness.test.ts` (176), `model.test.ts` (46), `speech.test.ts` (98)
  - `packages/shared/src/`: `audit.test.ts` (29), `composio.test.ts` (41), `conversation.test.ts` (87), `policy.test.ts` (158), `seed.test.ts` (93), `session.test.ts` (74)
  - Total: 12 test files, 1,781 lines. `apps/mobile` has **no** test files (`package.json` has no `test` script) and is excluded from `turbo test`'s effective scope.
- **Test Frameworks**: Vitest `^3.0.9` (`vitest run`) in both `apps/api` and `packages/shared`; configured via minimal `vitest.config.ts` (`include: ["src/**/*.test.ts"]`) in each.
- **Coverage Config**: absent — no `coverage` block in either `vitest.config.ts`, no `@vitest/coverage-*` devDependency in any package.json, no coverage thresholds enforced anywhere. Root `pnpm test` → `turbo test` fans out to both testable packages but there is no aggregate coverage report step.

### Code Quality Indicators

- **Linting**: no ESLint/Biome/other linter config found anywhere in the repo (checked root and each package for `.eslintrc*`, `.prettierrc*`, `eslint.config.*` — none present, and no `lint` script in any `package.json`). `docs/CONVENTIONS.md` names "TypeScript strict" and formatter-by-convention as the code-style bar but no automated linter enforces it; `pnpm typecheck` (via `tsc --noEmit`, `strict: true`) is the closest automated gate.
- **CI/CD**: no `.github/` directory / GitHub Actions workflows exist in the repo at all. `AGENTS.md`'s "Definition of done" (`pnpm typecheck && pnpm test` must pass) is a documented, human/agent-enforced gate, not an automated CI gate.
- **Documentation**: strong and unusually disciplined for a hackathon-scale repo — five canonical, cross-referenced Markdown files (`README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/SAFETY.md`) explicitly designated as the single source of truth, with an enforced rule ("update these same files in the same PR", "do not create extra NOTES.md/CONTEXT.md") against documentation fork/drift. Inline JSDoc-style comments are present at most non-trivial function/module boundaries in `apps/api/src` and `packages/shared/src` (e.g., harness system-prompt rationale, session-store clarification-budget logic, ElevenLabs/OpenAI client modules), explaining *why* not just *what*. `docs/SAFETY.md` explicitly declares itself normative over stale docs ("If they disagree, the code is wrong or this file is stale — fix both").

### Technical Debt Signals

- **No CI pipeline** — `pnpm typecheck`/`pnpm test` are documented as required but nothing runs them automatically on push/PR; regressions can land on `main` undetected until a human runs the commands.
- **No linter** — style/correctness issues beyond what `tsc --strict` catches (e.g., unused vars depending on tsconfig, `any` overuse, React hook dependency mistakes) are not automatically caught. `apps/mobile`'s hooks-heavy `useKasamaConversation.ts` in particular would benefit from `eslint-plugin-react-hooks`.
- **In-memory, non-durable state** — both `auditLog` (`apps/api/src/audit-log.ts`) and `sessionStore` (`apps/api/src/session-store.ts`) are process-local `Map`/array structures with no persistence layer; explicitly documented as intentional for the current demo scope ("Not durable" in ARCHITECTURE.md) but is a structural limitation if the project moves past a single-process demo.
- **No mobile test suite** — `apps/mobile` has zero automated tests; conversation-phase state machine logic in `useKasamaConversation.ts` (state transitions across `idle/listening/thinking/speaking/clarify/micDenied/error`) is exercised only manually.
- **Stub tool implementations with real policy/audit wrapping** — `find_ride_options` always returns an empty options array and `book_ride` always returns `status: "not_implemented"` (`apps/api/src/invoke-tool.ts` `executeStub`). This is explicitly intentional per `docs/CONVENTIONS.md` ("Never return a fake 'booked' Uber that skipped policy") rather than debt, but is a functional gap any downstream design/planning work must account for — live Uber and live calendar are tracked as future issues (`#14`/`#7`).
- **Two independent conversation-turn decision engines** — a rules-based regex/keyword turn (`apps/api/src/conversation.ts`, `decide()`) and a ChatGPT-driven harness (`apps/api/src/harness.ts`, `runHarnessTurn()`) implement materially overlapping logic (ride proposal construction, appointment-lookup formatting, yes/no detection, clarification budget) with separate code paths and separate regex constants (`YES`/`NO` duplicated in both files with a case-sensitivity difference — `conversation.ts`'s `YES`/`NO` are case-sensitive after `normalize()` lowercases input; `harness.ts`'s are declared with an explicit `i` flag). This duplication is a maintenance/consistency risk if the two engines drift.
- **Composio not wired into the main policy/audit loop** — `POST /composio/*` executes Gmail actions through the Composio SDK directly, bypassing `invokeTool`/`evaluateToolCall`/`auditLog` entirely. ARCHITECTURE.md flags this itself ("Do not send caretaker mail through Composio until `notify_caretaker` policy still gates it"), so it's a known, documented gap rather than a silent one — but it means Composio-executed actions currently have no policy gate and no audit trail, which is notable given the rest of the system's safety-first design.
- **Env-var loading duplicated** — `apps/api/src/load-env.ts` and `apps/mobile/scripts/start-expo.cjs` both hand-roll near-identical `.env`-file parsing (split on `=`, skip comments/blank lines, don't overwrite existing `process.env`) rather than sharing one utility or using a library like `dotenv`. Low risk (both are small and stable) but is duplicated logic.
- **Wide-open CORS** (`origin: "*"` in `apps/api/src/app.ts`) — reasonable for a LAN-only hackathon demo per the README's Expo Go/Simulator setup, but would need tightening before any non-local deployment.
- **`shamefully-hoist=true`** in `.npmrc` — a pnpm flag that flattens `node_modules` (closer to npm/yarn behavior) to work around packages that assume hoisting; itself a minor structural workaround rather than a bug, but signals at least one dependency (likely an Expo/React Native tool) that isn't fully pnpm-strict-compatible.

## Handoff Summary

- **Intent-relevant finding**: The repo already has a clean, intentional three-package boundary (`packages/shared` as the single contracts/policy source of truth, `apps/api` as the Hono service, `apps/mobile` as the Expo iOS client) with an explicit, code-enforced safety/policy model (`packages/shared/src/policy.ts` `evaluateAction`/`evaluateToolCall`, mirrored in `docs/SAFETY.md`) that gates every tool call behind actor identity, approval tokens, and consent — including a `model_cannot_self_approve` rule that stops ChatGPT from approving its own high-risk actions (`packages/shared/src/policy.ts:129`, `:168`). Any new work in the `agent-playground` intent should extend this existing tool/policy/audit pipeline (`invokeTool` in `apps/api/src/invoke-tool.ts`) rather than introduce a parallel path, per the repo's own stated convention in `AGENTS.md` ("If you add a tool, add it to `tools.ts`, map it in `TOOL_ACTIONS`, handle it in `invoke-tool.ts`...").
- **Risks / follow-up**:
  1. `apps/api/src/composio.ts` executes real Gmail actions outside the policy/audit pipeline — flag this to the architect if the active intent touches Composio or caretaker notifications, since it's a documented but currently real safety gap.
  2. Two parallel conversation-decision engines (`conversation.ts` rules-based vs. `harness.ts` ChatGPT-based) duplicate significant logic; any change to conversation behavior likely needs to touch both, and their `YES`/`NO` regexes have a case-sensitivity mismatch worth normalizing if touched.
  3. No CI and no linter exist; if this intent's scope includes hardening or scaling the project, a CI pipeline (`pnpm typecheck && pnpm test` on push) and a linter are the most impactful low-risk additions and are absent today.
  4. `apps/mobile` has zero automated tests — any UI/behavior change there is currently unverifiable except manually.
