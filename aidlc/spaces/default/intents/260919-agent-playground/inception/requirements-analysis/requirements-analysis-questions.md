# Requirements Analysis — Clarifying Questions

Created: 2026-09-19T20:52:00Z
Request source: GitHub issue #13 "Build a text/HTTP agent playground" (julesiet/sasehack26)

## Context pulled from the issue and the existing codebase

Issue #13 asks for a way to exercise intent → tools → policy → retries **without
the iOS UI**, now that its dependencies (#2 seed data, #3 tool contracts, #5
harness) are all closed. The API already exposes `POST /conversation/turn`
(routes to either the rules-based engine or the ChatGPT harness) and a
policy-gated `invokeTool` pipeline with an audit log — so this issue is
substantially about exposing/wrapping what already exists in a UI-free way,
not building the pipeline from scratch. Issue #7 (real ride/calendar tool
implementations) is still open and explicitly NOT blocking this issue.

## Q1 — Entry point shape

The issue says "HTTP or CLI entry point." An HTTP path (`POST
/conversation/turn`) already exists and does most of what's described. What
should this issue actually deliver?

A. A CLI script (e.g. `pnpm playground "<utterance>"`) that calls the existing HTTP API under the hood — no new HTTP surface
B. A CLI script that talks to the conversation/tool logic directly (in-process), bypassing HTTP entirely
C. Confirm the existing `POST /conversation/turn` + `POST /tools/:name` endpoints already satisfy the "HTTP" half, and only add a thin CLI wrapper for convenience
D. Something else — describe below
X. Other (please specify)

[Answer]: A. A CLI script (e.g. `pnpm playground "<utterance>"`) that calls the existing HTTP API under the hood — no new HTTP surface

## Q2 — Where the new code should live

Following this repo's stated "new feature" build order (shared → api → UI, only build what's needed), where should the playground entry point live?

A. A new script inside `apps/api` (e.g. `apps/api/src/playground.ts` + a `pnpm playground` command), reusing the existing conversation/tool code directly
B. A new standalone script/package outside `apps/api` (e.g. a `scripts/` or `tools/` directory at the repo root)
C. Not sure — recommend the simplest option that fits the existing layout
X. Other (please specify)

[Answer]: A. A new script inside `apps/api` (e.g. `apps/api/src/playground.ts` + a `pnpm playground` command), reusing the existing conversation/tool code directly

## Q3 — Approval-checkpoint behavior

The issue says: "Print or return approval checkpoints as structured prompts (do not auto-approve book/send/spend)." Today, `invokeTool` already returns an `allow` / `deny` / `requires_approval` decision without an interactive approval loop — nothing currently lets a human grant approval mid-run.

A. The playground should just print the pending-approval decision and stop there (matches today's behavior — no new interactive approval mechanism)
B. The playground should let the operator interactively approve/deny a pending action from the CLI itself (this would mean extending the actor/approval model)
C. Not sure — flag as an open question for the architect to resolve during design
X. Other (please specify)

[Answer]: A. The playground should just print the pending-approval decision and stop there (matches today's behavior — no new interactive approval mechanism)

## Q4 — Retry/handoff for failed tools

The acceptance criteria says "Failed tools return a retry/handoff payload." `find_ride_options` and `book_ride` are currently stubs (empty results / `not_implemented`) — real implementations are tracked separately in issue #7.

A. This issue only needs to surface a retry/handoff-shaped response when a stub tool "fails" (e.g. `book_ride`'s `not_implemented`) — no real retry logic; actual tool implementation stays in #7
B. This issue should implement real retry logic (e.g. re-attempt, exponential backoff) even against the stubs
C. Not sure — treat as an open question
X. Other (please specify)

[Answer]: A. This issue only needs to surface a retry/handoff-shaped response when a stub tool "fails" (e.g. `book_ride`'s `not_implemented`) — no real retry logic; actual tool implementation stays in #7

## Q5 — Which conversation engine to exercise

The API already supports two engines: a rules-based engine (`conversation.ts`, always available) and a ChatGPT-harness engine (`harness.ts`, used when a model API key is configured).

A. Exercise whichever engine the existing routing already selects (no playground-specific override) — same behavior as the mobile app today
B. Let the operator choose the engine via a flag (e.g. `--engine rules` / `--engine harness`) for easier testing/demo of both paths
C. Not sure — recommend based on what best serves manual testing
X. Other (please specify)

[Answer]: C, resolved to a combination of A+B — Recommendation: default to whatever the existing `MODEL_API_KEY`-based routing already selects (so the playground exercises the same path production/mobile traffic hits), but add an optional `--engine rules|harness` override flag so both paths can be exercised in one session without unsetting environment variables. This serves both fidelity (default matches real behavior) and testability (either path reachable on demand).

## Q6 — Testing expectations

The team's affirmed testing posture is test-after, no formal coverage floor, and CI (typecheck + test on push/PR) is being adopted going forward.

A. Yes — this new entry point should ship with automated tests (e.g. an integration-style test that runs a full utterance through and asserts on the shape of the response)
B. Manual verification via the acceptance criteria's example `curl`/CLI run is sufficient for this issue; no new automated tests required
X. Other (please specify)

[Answer]: A. Yes — this new entry point should ship with automated tests (e.g. an integration-style test that runs a full utterance through and asserts on the shape of the response)

## Q7 — Output detail for the audit trail

The acceptance criteria requires the response to include appointment context, ride options, and a pending approval. `GET /audit` already exists as a separate query endpoint.

A. The playground's own output is enough (appointment/ride/approval info in the turn response); the audit trail stays a separate thing you check via `GET /audit` if you want it
B. The playground should also print the relevant audit-log entries inline after each run, so a single command shows both the response and what got logged
X. Other (please specify)

[Answer]: A. The playground's own output is enough (appointment/ride/approval info in the turn response); the audit trail stays a separate thing you check via `GET /audit` if you want it
