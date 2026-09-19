# Code Quality Assessment — Kasama

## Test Coverage

- **Test organization**: co-located with source (`*.test.ts` beside the unit under test, not a separate `tests/` tree), per `docs/CONVENTIONS.md` ("Tests next to the unit"). See `code-structure.md` for the file-classification breakdown.
- **Test inventory**:
  - `apps/api/src/`: `app.test.ts` (661 lines — largest test file, full HTTP-route coverage), `composio.test.ts` (147), `conversation.test.ts` (171), `harness.test.ts` (176), `model.test.ts` (46), `speech.test.ts` (98)
  - `packages/shared/src/`: `audit.test.ts` (29), `composio.test.ts` (41), `conversation.test.ts` (87), `policy.test.ts` (158), `seed.test.ts` (93), `session.test.ts` (74)
  - **Total**: 12 test files, 1,781 lines, both testable packages (`@kasama/api`, `@kasama/shared`) covered.
  - Individual test bodies were inventoried by name/line-count in this scan, not read line-by-line (see `reverse-engineering-timestamp.md` → Scope of Analysis).
- **Test framework**: Vitest `^3.0.9` (`vitest run`) in both `apps/api` and `packages/shared`, via minimal `vitest.config.ts` (`include: ["src/**/*.test.ts"]`) in each.
- **Coverage tooling**: absent — no `coverage` block in either `vitest.config.ts`, no `@vitest/coverage-*` devDependency anywhere, no enforced coverage threshold. Root `pnpm test` fans out via `turbo test` to both testable packages, but there is no aggregate coverage report step.
- **`apps/mobile` has zero automated tests** — no `test` script in its `package.json`, and it is excluded from `turbo test`'s effective scope. The most test-worthy logic in this package — the voice-loop state machine in `useKasamaConversation.ts` (transitions across `idle/listening/thinking/speaking/clarify/micDenied/error`) — is exercised only manually today.

## Linting

**No linter is configured anywhere in the repo.** Checked root and each package for `.eslintrc*`, `.prettierrc*`, `eslint.config.*` — none present, and no `lint` script in any `package.json`. `docs/CONVENTIONS.md` names "TypeScript strict" and formatter-by-convention as the code-style bar, but no automated tool enforces it. `pnpm typecheck` (`tsc --noEmit`, `strict: true` on `apps/api` and `packages/shared`) is the closest automated gate, and it does not catch style issues, unused variables (depending on tsconfig settings), `any` overuse, or React-hooks-dependency mistakes.

## CI/CD

**No CI pipeline exists.** No `.github/` directory or GitHub Actions workflow files anywhere in the repo (confirmed absent). `AGENTS.md`'s "Definition of done" (`pnpm typecheck && pnpm test` must pass) is a documented, human/agent-enforced gate — not an automated one. This means regressions can land on the trunk undetected until someone manually runs the commands.

## Documentation Quality

**Strong and unusually disciplined for a hackathon-scale repo.** Five canonical, cross-referenced Markdown files are explicitly designated as the single source of truth:

- `README.md`, `ARCHITECTURE.md`, `AGENTS.md`, `docs/CONVENTIONS.md`, `docs/SAFETY.md`

The repo enforces an explicit anti-fork rule against documentation drift: "update these same files in the same PR", "do not create extra NOTES.md/CONTEXT.md". `docs/SAFETY.md` explicitly declares itself normative over stale docs: "If they disagree, the code is wrong or this file is stale — fix both." Inline JSDoc-style comments are present at most non-trivial function/module boundaries in `apps/api/src` and `packages/shared/src` (e.g., harness system-prompt rationale, session-store clarification-budget logic, ElevenLabs/OpenAI client modules), explaining *why*, not just *what*.

## Technical Debt Signals

1. **No CI pipeline** — `pnpm typecheck`/`pnpm test` are documented as required but nothing runs them automatically on push/PR.
2. **No linter** — style/correctness issues beyond `tsc --strict` are not automatically caught; `useKasamaConversation.ts`'s hooks-heavy logic in particular would benefit from `eslint-plugin-react-hooks`.
3. **In-memory, non-durable state** — both the Audit Log (`apps/api/src/audit-log.ts`) and Session Store (`apps/api/src/session-store.ts`) are process-local `Map`/array structures with no persistence layer. Explicitly documented as intentional for the current demo scope ("Not durable" in `ARCHITECTURE.md`), but a structural limitation if the project moves past a single-process demo. See `architecture.md` → Improvement Opportunities.
4. **No mobile test suite** — `apps/mobile` has zero automated tests (see Test Coverage above); the voice-loop state machine is exercised only manually.
5. **Stub tool implementations with real policy/audit wrapping** — `find_ride_options` always returns an empty options array and `book_ride` always returns `status: "not_implemented"` (`apps/api/src/invoke-tool.ts` `executeStub`). Explicitly intentional per `docs/CONVENTIONS.md` ("Never return a fake 'booked' Uber that skipped policy") rather than debt, but a real functional gap any downstream design/planning work must account for — live Uber and live calendar integration are tracked as future issues (`#14`/`#7`).
6. **Two independent conversation-turn decision engines** — the Rules-based Conversation Engine (`apps/api/src/conversation.ts`, `decide()`) and the ChatGPT Harness (`apps/api/src/harness.ts`, `runHarnessTurn()`) implement materially overlapping logic (ride proposal construction, appointment-lookup formatting, yes/no detection, clarification budget) via separate code paths and separate regex constants. Their `YES`/`NO` regexes have a case-sensitivity mismatch: `conversation.ts`'s are case-sensitive after `normalize()` lowercases input, while `harness.ts`'s are declared with an explicit `i` flag. This duplication is a maintenance/consistency risk if the two engines drift further. See `architecture.md` → Improvement Opportunities.
7. **Composio not wired into the main policy/audit loop** — `POST /composio/*` executes Gmail actions through the Composio SDK directly, bypassing `invokeTool`/`evaluateToolCall`/`auditLog` entirely (see `api-documentation.md` and `dependencies.md`). `ARCHITECTURE.md` flags this itself ("Do not send caretaker mail through Composio until `notify_caretaker` policy still gates it") — a known, documented gap rather than a silent one, but it means Composio-executed actions currently have no policy gate and no audit trail, notable given the rest of the system's safety-first design (see `business-overview.md`).
8. **Env-var loading duplicated** — `apps/api/src/load-env.ts` and `apps/mobile/scripts/start-expo.cjs` both hand-roll near-identical `.env`-file parsing rather than sharing one utility or using a library like `dotenv`. Low risk (both small and stable) but duplicated logic.
9. **Wide-open CORS** (`origin: "*"` in `apps/api/src/app.ts`) — reasonable for a LAN-only hackathon demo (per the README's Expo Go/Simulator setup), but would need tightening before any non-local deployment.
10. **`shamefully-hoist=true`** in root `.npmrc` — a pnpm flag flattening `node_modules` to work around a package that assumes hoisting; a minor structural workaround, signaling at least one dependency (likely an Expo/React Native tool) isn't fully pnpm-strict-compatible.

## Overall Assessment

The codebase shows a **deliberate quality/rigor split**: the safety-critical parts of the system (contracts, policy engine, audit trail, documentation discipline) are unusually well-engineered for a hackathon timeline, while the process-automation parts (CI, linting, mobile test coverage) are entirely absent. This is consistent with the project's own stated maturity (see `business-overview.md` → Project Maturity) — a deliberate demo/prototype, not a gap born of neglect in the areas that matter most for its safety story. The most impactful low-risk quality additions, if this intent's scope includes hardening, are: a CI pipeline (`pnpm typecheck && pnpm test` on push), a linter, and closing the Composio policy/audit gap before any real caretaker-notification email path ships.
