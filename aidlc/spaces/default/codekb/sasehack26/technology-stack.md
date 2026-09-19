# Technology Stack — Kasama

Versions below are taken from each package's `package.json` (workspace-resolved via pnpm); `node_modules` internals were not scanned. See `component-inventory.md` for which component uses which library.

## Languages

- **TypeScript** `^5.8.2` — used across all three packages; `strict: true` on `apps/api` and `packages/shared` tsconfigs. `apps/mobile`'s tsconfig extends `expo/tsconfig.base`.

## Core Libraries (cross-cutting)

| Library | Version | Purpose | Used by |
|---|---|---|---|
| Zod | `^3.24.2` | Schema/validation layer; the contracts source of truth for all cross-boundary data | `@kasama/shared` (defines), `@kasama/api` (validates) |

## `@kasama/api` — Service Stack

| Library | Version | Purpose |
|---|---|---|
| Hono | `^4.7.5` | HTTP framework — all 11 routes |
| `@hono/node-server` | `^1.14.1` | Node adapter for Hono |
| `@composio/core` | `^0.18.1` | Composio Platform SDK (Gmail integration) |
| `tsx` | `^4.19.3` | TypeScript execution for dev/start scripts (no separate build step) |
| vitest | `^3.0.9` | Test runner |

External HTTP integrations (no SDK, raw `fetch`): OpenAI Chat Completions, ElevenLabs STT/TTS — see `dependencies.md` for endpoints and auth.

## `@kasama/mobile` — Client Stack

| Library | Version | Purpose |
|---|---|---|
| Expo SDK | `~57.0.24` | React Native application framework/toolchain |
| React | `19.2.3` | UI library |
| React Native | `0.86.3` | Native runtime |
| `expo-audio` | `~57.0.5` | Microphone capture (voice input) |
| `expo-file-system` | `~57.0.7` | File I/O (audio buffering) |
| `expo-linear-gradient` | `~57.0.2` | UI gradients |
| `expo-speech` | `~57.0.3` | On-device speech utilities |
| `expo-status-bar` | `~57.0.1` | Status bar control |
| `@expo/vector-icons` | `^15.0.2` | Icon set |
| `react-native-safe-area-context` | `~5.7.0` | Safe-area layout |

No CSS-in-JS or UI kit beyond React Native `StyleSheet` — design tokens centralized in `apps/mobile/src/theme.ts` per `docs/CONVENTIONS.md`.

## `packages/shared` — Library Stack

Only external dependency: **Zod** `^3.24.2` (see above). No framework dependency; package is exported as raw TS source (`exports: "./src/index.ts"`), no build/emit step.

## Build & Tooling

| Tool | Version | Purpose |
|---|---|---|
| pnpm | `9.15.9` (`packageManager` field, root `package.json`) | Package manager / workspace resolution |
| Turborepo | `^2.5.0` | Monorepo task graph orchestration (root) |
| vitest | `^3.0.9` | Test runner (`apps/api`, `packages/shared`) |

Full build-system config file inventory and the task-dependency graph are in `code-structure.md` and `dependencies.md`; not repeated here.

## Data / Persistence

**None.** No ORM, no database library anywhere in the stack. All persistence is in-process (`Map`/array structures in `apps/api/src/audit-log.ts` and `session-store.ts`), explicitly documented as non-durable (cleared on process restart). See `architecture.md` → Key Design Decisions and `code-quality-assessment.md` → Technical Debt Signals.

## Notable Absences

- No linter (ESLint/Biome/other) configured anywhere in the repo.
- No CI/CD tooling (no `.github/` directory or workflow files).
- No test coverage tooling (`@vitest/coverage-*` not present, no coverage thresholds configured).
- `apps/mobile` has no test framework configured (no `test` script).

Full detail on these gaps is in `code-quality-assessment.md`.
