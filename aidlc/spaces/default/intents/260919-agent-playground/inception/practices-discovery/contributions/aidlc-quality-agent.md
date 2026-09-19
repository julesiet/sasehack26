**Collaborator:** aidlc-quality-agent

## Contribution

Independent inspection performed: `find`/`grep` over the working tree for
`vitest.config*`, `*.test.ts`, CI/`*.yml`/`*.yaml` files; direct reads of
`apps/api/vitest.config.ts`, `packages/shared/vitest.config.ts`, root and
per-package `package.json` (`apps/api`, `packages/shared`, `apps/mobile`),
`AGENTS.md`, `docs/CONVENTIONS.md`, and the bodies of several test files
(`apps/api/src/app.test.ts`, `apps/api/src/model.test.ts`,
`apps/api/src/composio.test.ts`, `packages/shared/src/policy.test.ts`); plus
the already-published `code-quality-assessment.md` in CodeKB. This confirms
the lead's factual claims and adds testing-pattern and gap detail the lead's
draft does not currently capture.

### Confirmed independently (no discrepancy with the lead's draft)

- Vitest `^3.0.9`, invoked as `vitest run` per package (`apps/api`,
  `packages/shared`), fanned out workspace-wide via root `pnpm test` →
  `turbo test`. Both `vitest.config.ts` files are minimal
  (`include: ["src/**/*.test.ts"]`) with no `coverage` block.
- 12 co-located `*.test.ts` files across the two testable packages; `apps/mobile`
  has no `test` script and no `vitest.config.ts` — zero automated tests,
  verified by absence from both the `find *.test.ts` scan and its
  `package.json` scripts.
- No `@vitest/coverage-*` dependency anywhere → no coverage tooling, no
  numeric floor evidenced.
- No `.github/` directory and no `*.yml`/`*.yaml` in the tree besides pnpm's
  own `pnpm-lock.yaml`/`pnpm-workspace.yaml` → no CI pipeline, confirmed
  directly (`ls .github` fails).
- No lint/format script in any of the four `package.json` files I read → no
  linter/formatter, consistent with CodeKB's `code-quality-assessment.md`.

### Additional findings (testing patterns and gaps not yet reflected in the draft)

1. **Test quality is genuinely good, not just present.** Assertions in the
   files I sampled are specific and behavior-locking, not vacuous
   (`app.test.ts` asserts exact HTTP status, `denied`/`preview`/`sent` flags,
   and the shape of resulting audit-log events; `policy.test.ts` exercises
   every actor/action combination in the policy table with `toMatchObject`
   assertions on `allowed`/`requirement`/`reason`). This satisfies the
   Construction-phase guardrail against tests that "always pass regardless of
   implementation." Worth stating explicitly in `team-practices.md` as an
   observed strength, not just "tests exist."
2. **External I/O is tested via dependency injection, not mocking
   frameworks.** `model.test.ts` injects a `fetchImpl` function into
   `createOpenAiChatComplete(...)` to fake the OpenAI HTTP call deterministically,
   with no real network access. `composio.test.ts` similarly injects an
   `execute: vi.fn(...)` implementation rather than mocking the `@composio/core`
   module globally. This is a real, evidenced code/test co-design pattern
   (constructor/factory functions accept an injectable I/O seam) that makes
   the suite fast and network-independent — it should be captured as a
   **Testing Posture** or **Code Style** convention going forward (e.g., "new
   modules that call external HTTP/SDK boundaries should accept an injectable
   client/fetch implementation to stay unit-testable"), not left implicit.
3. **No distinct unit/integration tiers exist today — it's a single co-located
   tier.** `apps/api/src/app.test.ts` (661 lines, the largest test file)
   drives the full Hono app via `app.request(...)`, which is integration-level
   testing (full HTTP request → route → policy → audit-log side effects), not
   narrow unit testing, yet it lives in the same `*.test.ts` co-location
   convention as narrower unit tests like `model.test.ts`. The lead's draft
   states the location convention correctly but doesn't note that the
   "pyramid" (unit > integration > e2e) doesn't currently exist as a
   deliberate tiering — everything is one flat tier. Worth asking in
   interview whether the team wants an explicit integration-test
   tier/directory, or intends to keep the current flat co-located approach as
   affirmed practice.
4. **Highest-risk, zero-coverage area: the mobile voice-loop state machine.**
   `apps/mobile`'s `useKasamaConversation.ts` (per CodeKB) manages transitions
   across `idle/listening/thinking/speaking/clarify/micDenied/error` and is
   the most state-machine-like, most test-worthy logic in the whole
   repo — and it has zero automated coverage today, exercised only manually.
   Given the safety-critical nature of the product (senior-facing, policy-gated
   actions), this is the single highest-leverage testing gap to raise in the
   human interview, ranked above generic "adopt a coverage floor" framing.
5. **CI is the highest-leverage, lowest-risk addition available.** Both
   testable packages already have a clean, deterministic, mock-free-of-network
   test suite (12 files, 1,781 lines) that passes locally today per
   `AGENTS.md`'s Definition of Done. Standing up a minimal CI workflow
   (`pnpm typecheck && pnpm test` on push/PR) requires no new test-writing —
   it only wires up what already exists and passes. I'd elevate this above
   the other UNRESOLVED items in priority for the interview, since it's the
   rare "gap" that costs almost nothing to close today.
6. **Regression-test opportunity tied to a known gap.** CodeKB
   (`code-quality-assessment.md` → Technical Debt Signals #7) documents that
   `POST /composio/*` bypasses `invokeTool`/`evaluateToolCall`/`auditLog`
   entirely — no test in `apps/api/src/composio.test.ts` currently asserts
   that Composio-executed actions *are* audit-logged, because structurally
   they aren't. When/if this gap is closed, a contract test locking in "every
   Composio action produces an audit event" should be written alongside the
   fix — worth noting as a forward action, not a current-state complaint.

### Recommendation for `team-practices.md` integration

Add a short sub-bullet under **Testing Posture** capturing point 2 (DI-based
I/O testability) as an evidenced pattern, and reorder/rephrase the
UNRESOLVED testing items so "stand up CI" and "cover the mobile voice-loop
state machine" are called out as the two highest-priority items for the
human interview, rather than flat list items of equal weight with "adopt a
coverage floor."

## Positions

- AGREE: the lead's "test-after" methodology classification and evidence
  (`docs/CONVENTIONS.md` + `AGENTS.md` Definition of Done, no TDD/red-green
  language found) — independently confirmed by reading both documents.
- AGREE: the lead's framing of `apps/mobile`'s zero test coverage as an
  evidenced gap rather than a stated policy — confirmed via `find` and
  `package.json` inspection; no `test` script, no config, no test files.
- AGREE: the lead's "no coverage tooling, no coverage threshold" finding —
  confirmed both `vitest.config.ts` files have no `coverage` block and no
  `@vitest/coverage-*` devDependency exists in either `package.json`.
- OBJECT: the draft's Testing Posture section is silent on the
  dependency-injection testing pattern (injectable `fetchImpl`/`execute`
  functions) that both `apps/api` test suites actually use — this is a real,
  evidenced convention worth naming explicitly so future units keep following
  it, not just an incidental detail.
- OBJECT: the draft lists "CI pipeline adoption" and "apps/mobile test
  coverage" as UNRESOLVED items #7 and #8 among nine roughly equal-weight
  items — as the quality reviewer I'd rank these two above the others
  (coverage-floor question, BDD/ATDD framing) because they are the two gaps
  with the clearest cost/benefit: CI costs nothing new to write (tests
  already pass locally) and the mobile voice-loop is the single most
  state-machine-like, safety-adjacent, currently-untested piece of logic in
  the repo.
- OBJECT: the draft does not distinguish that `app.test.ts` is integration-level
  (full HTTP request through the Hono app, policy engine, and audit log) while
  other files like `model.test.ts` are narrow unit tests — both share the same
  co-location convention, so the "test pyramid" concept doesn't currently
  apply as a deliberate tiering. Interview should clarify whether that's
  intentional or worth separating going forward.
