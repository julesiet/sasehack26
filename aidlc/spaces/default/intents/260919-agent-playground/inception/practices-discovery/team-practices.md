# Team Practices — sasehack26 (Kasama)

> Final integration (Step 5). Incorporates the lead's repository-evidence
> draft, three independent reviews (quality, developer, devsecops), and the
> completed human interview (`practices-discovery-questions.md`). Interview
> answers are authoritative wherever they resolve a question the evidence
> alone could not settle.

## Way of Working

- **Branching**: feature branches per person/topic, named `<github-username>/<short-topic>`
  (evidence: `julesiet/harness`, `julesiet/voice-loop`, `julesiet/expose-http`,
  `julesiet/tool-rules`, `julesiet/app-scaffold`, plus a personal branch
  `test-Ashton`). All observed remote branches merge back into `main`.
- **Merge style**: true merge commits via GitHub PR ("Merge pull request #N
  from julesiet/<branch>"), not squash-merge — every inspected merge commit
  in `git log --merges` has two parents, so the source branch's individual
  commits are preserved in `main`'s history.
- **Branch lifetime**: short-lived, mapping 1:1 to a single feature slice,
  each closed out by one PR merge — consistent with trunk-based development.
  `main` is the trunk (`remotes/origin/HEAD -> origin/main`); no long-lived
  `develop`/`release` branch exists.
- **PR ownership (interview Q1, confirmed)**: the branching/merge pattern
  observed above stays exactly as-is — short branches → PR → merge to
  `main`. The human runs all PR creation and merging themselves; this
  workflow/agent works on the branch and does not create, review-gate, or
  merge PRs on the human's behalf. This is an operating note about who does
  the merging, not a stated review-approval policy — no formal
  review-before-merge requirement was affirmed.

## Walking Skeleton

- The commit history shows a deliberate **scaffold-first** pattern: commit
  `1abafee`/`61b758b` "Scaffold the Kasama iOS app and API so the team can
  run before designs land" — an app/API skeleton was stood up ahead of
  feature work and ahead of finished UI designs.
- `AGENTS.md`'s issue-label workflow (`can-start-now` + `no-design-needed`
  vs. `blocked:design`/`needs-design` vs. `design-ready`) reinforces a
  "build the skeleton and stub incrementally, don't block on design"
  posture, and `docs/CONVENTIONS.md` mandates stub results stay "valid Zod"
  rather than faking success.
- **Affirmed standing practice (interview Q2)**: yes — walking skeleton is
  now team policy, not a one-off. For future substantial features, build a
  thin, end-to-end working slice first, gated and explicitly approved by the
  human before other work on that feature continues. This matches the
  org-level default (`aidlc/spaces/default/memory/org.md` → "Walking
  Skeleton": Bolt 1 is solo, gated, and human-approved) and is now confirmed
  as this project's intended practice rather than an inference from history.

## Testing Posture

- **Methodology**: test-after
- **Ordering**: implementation and its co-located `*.test.ts` file are added
  together in the same unit of work, with the test written after the
  implementation it exercises — `docs/CONVENTIONS.md` states "Tests next to
  the unit (`*.test.ts`) with vitest," `AGENTS.md`'s Definition of Done
  requires `pnpm test` to pass before work is considered done, and no
  test-first/TDD language exists in either document.
- **Confirmed intentional (interview Q3)**: test-after is correct and
  deliberate, not a hackathon-time-pressure artifact. No formal numeric
  coverage floor is required — the team affirmed keeping test-after with no
  coverage-percentage target.
- **Test quality is genuinely strong today, not just present**
  (quality-agent finding): assertions sampled in `apps/api/src/app.test.ts`
  and `packages/shared/src/policy.test.ts` are specific and
  behavior-locking (exact HTTP status, `denied`/`preview`/`sent` flags,
  resulting audit-log event shape; every actor/action combination in the
  policy table asserted via `toMatchObject`) — this satisfies the
  Construction-phase guardrail against tests that "always pass regardless of
  implementation" and should be preserved as new tests are added.
- **Dependency-injection testing convention (quality-agent finding, adopt
  going forward)**: external I/O is tested via an injectable seam, not a
  mocking framework — `model.test.ts` injects a `fetchImpl` into
  `createOpenAiChatComplete(...)`, `composio.test.ts` injects an
  `execute: vi.fn(...)` implementation rather than mocking `@composio/core`
  globally. New modules that call external HTTP/SDK boundaries should follow
  this pattern (accept an injectable client/fetch implementation) to stay
  unit-testable without real network access, matching the factory+singleton
  code-style convention below.
- **No deliberate unit/integration tiering exists today** (quality-agent
  finding): everything lives in one flat co-located `*.test.ts` tier —
  `app.test.ts` (661 lines) drives the full Hono app end-to-end
  (integration-level), while `model.test.ts` is a narrow unit test, yet both
  share the same location convention. This is noted as observed practice,
  not changed by the interview; the team may formalize a separate
  integration tier later if it becomes useful.
- Test framework: Vitest `^3.0.9`, invoked as `vitest run` per package, run
  workspace-wide via `pnpm test` → `turbo test`. Both `vitest.config.ts`
  files are minimal (`include: ["src/**/*.test.ts"]`) with no `coverage`
  block; no `@vitest/coverage-*` dependency exists anywhere.
- **Mobile test coverage (interview Q4, confirmed — this matters)**:
  `apps/mobile` has zero automated tests today, including its most
  state-machine-like and safety-adjacent piece of logic — the voice-loop
  conversation hook (`useKasamaConversation.ts`, transitions across
  `idle/listening/thinking/speaking/clarify/micDenied/error`). The team
  affirmed closing this gap matters going forward: new or changed mobile
  logic, especially that state machine, should come with tests from this
  point on. This is not a retroactive backfill requirement for existing
  mobile code, only for new/changed logic.
- **CI-enforced going forward (interview Q6)**: `pnpm typecheck && pnpm test`
  will run automatically on every push/PR via a new CI pipeline (see Code
  Style below) rather than only being manually/agent-enforced as it is
  today.

## Deployment

- **No CI/CD pipeline exists today.** No `.github/` directory anywhere in
  the working tree, no GitHub Actions or other CI config files at the repo
  root or in any package. The only `.yml`/`.yaml` files in the repo
  (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) are package-manager artifacts.
- No deployment scripts, environment-tier configuration, or hosting/infra
  config exist anywhere in `README.md`, `ARCHITECTURE.md`, or the codebase.
  There is explicitly "no product website" (`AGENTS.md`) — the only running
  surfaces are a local API process (`http://localhost:3001`) and the Expo
  Go / iOS Simulator mobile client, both run manually via `pnpm dev` /
  `pnpm ios`. State (audit log, session store) is in-memory only, non-durable,
  cleared on process restart.
- **Confirmed out of scope (interview Q5)**: no deployment is in scope right
  now. This stays a local/demo project. The org-level default ("deploy on
  merge to staging, manual approval gates production") is a framework
  default only and explicitly does **not** apply to this project at this
  time — revisit if/when the team decides to move toward a hosted
  environment.

## Code Style

- **Language/typing**: TypeScript, `strict: true` in `apps/api` and
  `packages/shared` tsconfigs (`apps/mobile` extends `expo/tsconfig.base`
  instead). `docs/CONVENTIONS.md` states "TypeScript strict" as the style
  bar.
- **Validation boundary**: Zod schemas at every boundary, with the schema
  and its derived TS type declared adjacently in the same file — schema
  first, type second — consistently across `packages/shared/src`
  (developer-agent finding: this schema-then-type pairing, not just "Zod at
  the boundary" in isolation, is the actual repo convention).
- **Naming conventions** (developer-agent finding, no exceptions found
  across 20+ source files read): kebab-case filenames for multi-word
  TypeScript modules (`invoke-tool.ts`, `session-store.ts`, `audit-log.ts`),
  single lowercase word where already one word (`composio.ts`, `policy.ts`);
  React components PascalCase `.tsx` (`ComposerPill.tsx`, `SeniorScreen.tsx`);
  hooks follow `useXxx.ts` (`useKasamaConversation.ts`); types PascalCase
  (`SessionState`, `PolicyDecision`); true constants SCREAMING_SNAKE_CASE
  (`POLICY_TABLE`, `HIGH_RISK_ACTIONS`); enum-like value sets use a
  lowercase-plural `as const` array paired with a derived
  `type X = (typeof x)[number]`; custom error classes are PascalCase,
  suffixed `Error`, named for the exact failure condition
  (`SttNotConfiguredError`, `ComposioNotConfiguredError`).
- **Factory + singleton pattern** (developer-agent finding — new modules
  should follow this): every stateful or side-effecting module exports a
  `create<Thing>()` factory that returns the implementation, plus a default
  singleton built from that factory under the un-prefixed name
  (`createSessionStore`/`sessionStore`, `createElevenLabsTranscriber`/
  `transcriber`, `createApp`/`app`). This is what makes the
  dependency-injection testing convention above possible (`createApp({
  transcribe, speak, composio, complete })` in tests) while routes use the
  plain singleton in production.
- **Split error-handling convention** (developer-agent finding — a real,
  evidenced idiom to keep following, not just a gap): two layer-specific
  idioms coexist deliberately. (1) Errors-as-values on the request/policy
  path — `evaluateAction`/`evaluateToolCall` in `packages/shared` return a
  `PolicyDecision` object rather than throwing, and Zod's `.safeParse()` is
  used wherever a failure is an expected, user-facing outcome. (2) Typed
  exceptions for provider/config failures — `apps/api`'s external client
  modules throw purpose-named error classes (`SttNotConfiguredError`, etc.),
  caught by `instanceof` in the route handler and mapped to specific HTTP
  codes (501/502/400). New code should follow whichever idiom matches the
  layer it's in rather than mixing them.
- **Known gap — no global Hono error-handling middleware** (developer-agent
  finding): there is no `app.onError(...)`. Each route catches its own
  errors independently; a couple of routes (`GET /sessions/:sessionId`,
  `GET /audit`) have no try/catch and would surface an unhandled 500 without
  the structured `{error, summary}` envelope other routes return. Not fatal
  for the current demo scope, but recorded as a known gap against the
  Construction-phase error-handling guardrail — worth closing if this
  becomes a standing codebase, and a good candidate for global middleware
  when CI/tooling work begins.
- **Mobile styling**: React Native `StyleSheet` only; no CSS-in-JS or UI
  kit; design tokens centralized in `apps/mobile/src/theme.ts`.
- **Minor coupling note** (developer-agent finding, informational): 
  `apps/api/src/session-store.ts` directly imports and calls `auditLog.list()`
  to build its `SessionView` projection, coupling the session layer to the
  audit layer's storage rather than receiving audit events as data. Minor at
  current scale; worth a one-line note in `ARCHITECTURE.md`/`CONVENTIONS.md`
  if a future unit changes audit storage and wants to preserve looser
  coupling.
- **Existing style is consistent in practice despite no tooling**
  (developer-agent finding): double-quoted strings, semicolons, ~2-space
  indentation, trailing commas in multiline literals are observed
  consistently across the codebase despite no linter/formatter being
  configured.
- **Tooling — adding both, going forward (interview Q6, confirmed)**: the
  repo currently has no linter/formatter (`.eslintrc*`/`.prettierrc*`
  absent, no `lint`/`format` script in any `package.json`) and no CI
  pipeline. The team affirmed adding **both**: ESLint + Prettier (fits the
  TypeScript/React Native stack) and a CI pipeline running
  `pnpm typecheck && pnpm test` on every push/PR. When the linter config is
  authored (a later Construction unit, not this stage), it should encode
  the existing, load-bearing idioms captured above (naming, factory
  +singleton, schema-then-type pairing, error-class style) rather than
  applying stock rules wholesale — a stock config risks churn-only diffs
  across a codebase that is already internally consistent in practice.
- **Security tooling — none configured today, noted as a practice area**
  (devsecops-agent finding): no SAST (CodeQL/Semgrep/SonarQube/ESLint
  security plugins), no dependency/supply-chain scanning (no Dependabot —
  `.github/` doesn't exist — no Renovate, no `pnpm audit`/`npm audit`/Snyk
  step anywhere), no secret-scanning tooling (gitleaks/trufflehog), and no
  DAST (expected, given no deployed environment). This is recorded as an
  observed gap in this practice area, not a new hard rule — see
  `evidence.md` for the accepted-technical-debt framing from interview Q7.
  If/when CI is stood up, a reasonable minimum security-gate shape to
  consider is a dependency-audit step (`pnpm audit --audit-level=high`) and,
  once ESLint exists, a security-focused ruleset addition
  (`eslint-plugin-security`) — offered as a future option, not mandated
  scope for the current intent.
- **Secrets management — verified good practice** (devsecops-agent
  finding): `.gitignore` excludes `.env`/`.env.local`; only `.env.example`
  files are tracked, and every secret-shaped key in them is left empty (no
  placeholder or real-looking values). `apps/api/src/load-env.ts` never
  overwrites an already-set `process.env` value and fails silently on a
  missing `.env`, which is appropriate for this project's designed-fallback
  model. This confirms the "never commit secrets" Forbidden rule
  (`discovered-rules.md`) is followed in verified practice, not just stated.
- Package manager pinned via `packageManager` field: `pnpm@9.15.9`; Node 20
  stated in `AGENTS.md`.
