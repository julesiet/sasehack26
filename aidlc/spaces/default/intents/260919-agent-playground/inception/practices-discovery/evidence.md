# Evidence — Practices Discovery — sasehack26 (Kasama)

> Final integration (Step 5). Folds in the three independent reviews
> (`contributions/aidlc-quality-agent.md`, `contributions/aidlc-developer-agent.md`,
> `contributions/aidlc-devsecops-agent.md`) and resolves every item that was
> open at draft time against the completed human interview
> (`practices-discovery-questions.md`).

## What was inspected

**Git history and branches** (repo root: `C:\Users\legas\Documents\GitHub\sasehack26`):
- `git log --oneline -30` — 22 commits shown, mix of feature commits and
  "Merge pull request #N" merge commits.
- `git log --merges -5 --pretty=format:"%H %P"` — confirmed every inspected
  merge commit has exactly two parents (a true merge, not a squash-merge
  rewrite).
- `git branch -a` — local: `main`, `origin/agent-playground` (current, a
  local branch tracking a same-named remote), `test-Ashton`. Remote:
  `origin/main` (default via `HEAD`), `origin/app-scaffold`,
  `origin/expose-http`, `origin/harness`, `origin/voice-loop`,
  `origin/origin/agent-playground`.
- `git rev-parse HEAD` — `4efba49431881d7e466f442b6f7e91e246532f80`.
- Directory/file scan for `.github/` and any `*.yml`/`*.yaml` CI config at
  repo root — `.github/` absent (confirms the reverse-engineering scan's
  prior finding); the only `.yml`/`.yaml` files present anywhere are
  `pnpm-lock.yaml` and `pnpm-workspace.yaml`, both package-manager artifacts,
  not CI config.
- `package.json` root scripts (`dev`, `dev:api`, `start`, `ios`, `build`,
  `typecheck`, `test`) — no `lint`/`format` script present.
- `README.md` and `ARCHITECTURE.md` grepped for "deploy", "staging",
  "production", "CI" — zero matches in either file.

**Explicit team-convention docs** (read in full):
- `AGENTS.md` — operating instructions for coding agents; contains the
  canonical-docs table, product scope, repo layout, run commands, current API
  surface, safety table pointer, issue-label workflow, git etiquette, and the
  "Definition of done for agent work."
- `docs/CONVENTIONS.md` — where code/docs go, the "new feature" build order
  (shared → api → mobile UI), code-style bullets, and tool-narrowness
  guidance.
- `docs/SAFETY.md` — the human-readable policy table, actor model
  (`model`/`senior`/`caretaker`/`doctor`), the `model_cannot_self_approve`
  rule, audit requirements, and language rules for care signals.

**Already-published CodeKB artifacts** (read, not re-scanned):
- `aidlc/spaces/default/codekb/sasehack26/code-structure.md`
- `aidlc/spaces/default/codekb/sasehack26/technology-stack.md`
- `aidlc/spaces/default/codekb/sasehack26/dependencies.md`
- `aidlc/spaces/default/codekb/sasehack26/code-quality-assessment.md`
- `aidlc/spaces/default/codekb/sasehack26/architecture.md`
- `aidlc/spaces/default/codekb/sasehack26/business-overview.md`

These independently confirm (not re-derive): no linter configured anywhere;
no CI/CD tooling anywhere; no test-coverage tooling; `apps/mobile` has zero
automated tests; tests are co-located `*.test.ts` (12 files, 1,781 lines
across `@kasama/api` and `@kasama/shared`); Vitest `^3.0.9` is the test
runner; `docs/SAFETY.md`/`packages/shared/src/policy.ts` is the safety source
of truth; the repo is explicitly a "hackathon-scale demo/prototype" with
in-memory, non-durable state.

**Independent reviewer inspections** (each reviewer worked from the repo
directly, without seeing the lead's draft or each other's work — see each
contribution file for their own methodology paragraph):
- `contributions/aidlc-quality-agent.md` — direct reads of both
  `vitest.config.ts` files, all four testable-package `package.json`s,
  `AGENTS.md`, `docs/CONVENTIONS.md`, and the bodies of
  `apps/api/src/app.test.ts`, `apps/api/src/model.test.ts`,
  `apps/api/src/composio.test.ts`, `packages/shared/src/policy.test.ts`.
- `contributions/aidlc-developer-agent.md` — direct reads of 20+ source
  files across `packages/shared/src`, `apps/api/src`, and
  `apps/mobile/src`, cross-checked against `code-structure.md` and
  `technology-stack.md`.
- `contributions/aidlc-devsecops-agent.md` — direct inspection for
  lint/format/SAST/DAST/secret/dependency-scanning config, plus a read of
  `docs/SAFETY.md` and `apps/api/src/app.ts` for the policy/audit
  enforcement surface and route-level auth.

## Human interview

`practices-discovery-questions.md` — 7 questions, all answered. Every
question that was open at draft time (below) is now resolved and linked to
its `[Answer]:` tag.

## What was inferred, and from where

| Practice area | Inference | Primary evidence |
|---|---|---|
| Branching strategy | Short-lived, per-topic feature branches (`<user>/<topic>`), merged to `main` via GitHub PR merge commits (not squashed) | `git branch -a`, `git log --merges` parent counts |
| Trunk | `main` is the trunk; no `develop`/`release` branch exists | `git branch -a` (`origin/HEAD -> origin/main`, no other long-lived branch) |
| Walking skeleton | A deliberate scaffold-before-design commit exists ("Scaffold the Kasama iOS app and API so the team can run before designs land"), reinforced by the `blocked:design`/`no-design-needed` issue-label workflow and the "never fabricate a stub result" convention | `git log` commit `1abafee`/`61b758b`; `AGENTS.md` → "Issues"; `docs/CONVENTIONS.md` → "Tools" |
| Testing methodology | Test-after (co-located test file per unit, required to pass, but no test-first/TDD language found) | `docs/CONVENTIONS.md` → "Code style"; `AGENTS.md` → "Definition of done" |
| Testing tooling | Vitest, no coverage tooling, no coverage threshold, mobile untested | `technology-stack.md`, `code-quality-assessment.md` |
| Deployment | No CI/CD, no deployment config, no environment topology, in-memory/non-durable state, local-only run surfaces | `.github/` absence confirmed directly; `README.md`/`ARCHITECTURE.md` grep (zero hits); `technology-stack.md`, `architecture.md` |
| Code style | TypeScript strict, Zod at the boundary, RN `StyleSheet` + centralized theme tokens, **no linter/formatter configured** (contradicts the org-level Prettier/ESLint default — flagged explicitly, not silently inherited) | `docs/CONVENTIONS.md` → "Code style"; `technology-stack.md`, `code-quality-assessment.md` → "Linting" |
| Hard constraints (mandated/forbidden) | Pulled from `AGENTS.md` "Definition of done," `docs/SAFETY.md` policy table and actor model, and `docs/CONVENTIONS.md` scope/layout rules | See `discovered-rules.md` for full citations |

## Resolved — human interview outcomes

Every item that was open at draft time is now resolved via
`practices-discovery-questions.md`. Full context/rationale lives in that
file; this table links each item to its answer and to where it now lives in
`team-practices.md` / `discovered-rules.md`.

| # | Item (as posed at draft) | Interview answer | Resolution recorded in |
|---|---|---|---|
| 1 | PR review requirement | Q1 → `X. Other`: branching stays as observed (short branches → PR → merge to `main`); the human handles all PR creation/merging themselves — this workflow/agent does not. No formal review-before-merge requirement was affirmed. | `team-practices.md` → Way of Working |
| 2 | Walking skeleton — affirmed methodology vs. one-off | Q2 → `A`: affirmed as standing practice — build a thin end-to-end slice first for future substantial features, gated and human-approved before other work continues. | `team-practices.md` → Walking Skeleton |
| 3 | Testing methodology confirmation / coverage floor | Q3 → `A`: test-after confirmed correct and intentional; no formal coverage-floor percentage required. | `team-practices.md` → Testing Posture |
| 4 | BDD/ATDD framing for acceptance criteria | Not asked as a separate question in the final interview (folded into Q3's options; `A` was chosen over the BDD option `D`) — test-after with ad hoc scenarios stays as-is, no formalized Given/When/Then testing convention adopted at this time. | `team-practices.md` → Testing Posture |
| 5 | Deployment — entirely unresolved | Q5 → `A`: no deployment in scope right now; stays a local/demo project. The org-level "deploy on merge to staging" default explicitly does not apply here. | `team-practices.md` → Deployment |
| 6 | Linter/formatter adoption | Q6 → `A`: add both ESLint + Prettier. | `team-practices.md` → Code Style |
| 7 | CI pipeline adoption | Q6 → `A` (same answer, both parts): add a CI pipeline running `pnpm typecheck && pnpm test` on every push/PR. | `team-practices.md` → Code Style, Testing Posture |
| 8 | `apps/mobile` test coverage | Q4 → `A`: closing this gap matters — new/changed mobile logic (especially the voice-conversation state machine) should come with tests going forward. Not a retroactive backfill requirement. | `team-practices.md` → Testing Posture |
| 9 | Composio policy/audit bypass (+ new: unauthenticated endpoints, raised by devsecops review) | Q7 → `B`: acceptable for now given this is a local/LAN-only demo; recorded as known technical debt, not a new hard rule. | See "Accepted technical debt" below and `discovered-rules.md` → "Notes on a known gap against an existing rule" |

## Reviewer findings folded into the final artifacts

Three independent reviews (`contributions/aidlc-quality-agent.md`,
`contributions/aidlc-developer-agent.md`,
`contributions/aidlc-devsecops-agent.md`) each confirmed the lead's factual
claims with no discrepancies, and each added findings not in the original
draft. All are now integrated into `team-practices.md`; summarized here with
their source:

- **Dependency-injection testing pattern** (quality agent) — `model.test.ts`
  and `composio.test.ts` test external I/O via an injectable
  `fetchImpl`/`execute` seam rather than a mocking framework. Now recorded
  as a Testing Posture convention to keep following.
- **No deliberate unit/integration test tiering** (quality agent) —
  `app.test.ts` is integration-level (full HTTP request through the app),
  `model.test.ts` is a narrow unit test, both share the same co-location
  convention. Recorded as observed practice, not changed by the interview.
- **Test quality is genuinely strong, not just present** (quality agent) —
  sampled assertions are specific and behavior-locking, satisfying the
  Construction-phase guardrail against vacuous tests.
- **Factory + singleton pattern** (developer agent) — every stateful module
  exports a `create<Thing>()` factory plus a default singleton; this is the
  structural mechanism that enables the DI testing pattern above. Recorded
  as a Code Style convention for new modules to follow.
- **Split error-handling idiom** (developer agent) — errors-as-values
  (`PolicyDecision`, Zod `.safeParse()`) on the request/policy path vs.
  typed exception classes for provider/config failures in `apps/api`
  clients. Recorded as a Code Style convention.
- **Missing global Hono error-handling middleware** (developer agent) — no
  `app.onError(...)`; two routes (`GET /sessions/:sessionId`, `GET /audit`)
  have no try/catch and would 500 without the structured envelope other
  routes return. Recorded as a known gap in Code Style, not escalated to a
  new Mandated/Forbidden rule.
- **Minor session-store/audit-log coupling** (developer agent) — informational
  note recorded in Code Style.
- **Security tooling absent as a practice area** (devsecops agent) — no
  SAST, dependency/supply-chain scanning, or secret-scanning tooling
  anywhere. Recorded explicitly in Code Style as an observed gap (not a new
  rule) so it's no longer only inferable from the lint/CI sections.
- **Secrets management verified as good practice, not just documented**
  (devsecops agent) — `.env`/`.env.local` gitignored, only empty-valued
  `.env.example` tracked, no hardcoded secret-shaped strings found by manual
  grep. Promoted from "documented convention" to "verified practice."

## Accepted technical debt (interview Q7 — not escalated to a hard rule)

Two gaps were raised directly to the human in interview Q7 and answered
`B`: acceptable for now given this is a local/LAN-only demo, recorded as
known technical debt rather than a required/forbidden practice.

1. **Unauthenticated `GET /audit` and `GET /sessions/:sessionId`**
   (devsecops-agent finding, new — not in the lead's draft or in
   `code-quality-assessment.md` beyond its CORS note). No authentication or
   session-ownership check exists on any route; `sessionId` is a
   client-suppliable/guessable string, not a server-issued credential, so
   these endpoints amount to an unauthenticated, enumerable read of another
   session's audit trail and state (including consent state) if the API is
   ever reachable beyond localhost. Currently low actual risk because the
   only run surfaces are `localhost:3001` and Expo Go on the same LAN, and
   there is no deployed environment. Recorded here as a **named
   precondition to close before any non-local deployment**, not as a
   current violation requiring action now.
2. **Composio policy/audit bypass** — `apps/api/src/composio.ts` and its
   `/composio/connect` / `/composio/execute` routes validate input with Zod
   but do not route through `invokeTool`/`evaluateToolCall`/`auditLog`.
   `ARCHITECTURE.md` self-documents this gap. As the devsecops review notes,
   this is in tension with the already-stated Mandated/Forbidden rules on
   audit logging and policy-gating (see `discovered-rules.md` for the
   cross-reference), but per the human's answer it stays recorded as known
   debt rather than becoming a new or restated hard rule at this time.

Both items should be revisited by a future stage (deployment-readiness
review, or a dedicated security-hardening unit) before this project moves
beyond local/LAN-only demo scope.

## Confirmations of prior reverse-engineering findings

- **Confirmed directly** (not just re-read from CodeKB): no `.github/`
  directory exists in the working tree today (`ls .github` fails with "No
  such file or directory").
- **Confirmed directly**: the only `.yml`/`.yaml` files anywhere in the repo
  are pnpm workspace/lock files, not CI configuration.
