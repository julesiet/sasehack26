# Requirements — Text/HTTP Agent Playground (GitHub Issue #13)

Source: GitHub issue #13, "Build a text/HTTP agent playground" (julesiet/sasehack26).
Dependencies #2 (seed data), #3 (tool contracts), #5 (harness) are closed. This
issue unblocks #7 (real ride/calendar tool implementations) and #5-adjacent
screen work by giving a UI-free way to exercise the pipeline.

## Intent Analysis

The team needs a way to manually and automatically exercise the existing
intent → tools → policy → audit pipeline (built in #2/#3/#5) **before the iOS
screens exist**, so that the conversational/tool/policy logic can be verified,
demoed, and iterated on without waiting on design work. The underlying
HTTP surface (`POST /conversation/turn`, `POST /tools/:name`) and policy/audit
pipeline already exist (`packages/shared/src/policy.ts`,
`apps/api/src/invoke-tool.ts`) — this issue is about **exposing that pipeline
through a CLI**, not building it from scratch (confirmed via requirements
interview Q1).

## Functional Requirements

### FR1 — CLI entry point
The system shall provide a CLI script inside `apps/api` (e.g. invoked as
`pnpm playground "<utterance>"`) that drives the existing conversation/tool
pipeline for a single text utterance, without requiring the mobile app.

- **FR1.1**: The CLI shall accept a text utterance as its primary argument.
- **FR1.2**: The CLI shall call the existing `POST /conversation/turn` HTTP
  endpoint under the hood (no new HTTP surface is introduced) using Maria's
  seeded demo actor/session context (`packages/shared/src/seed.ts`) as the
  default actor identity.
- **FR1.3**: The CLI shall default to whichever conversation engine the
  existing `MODEL_API_KEY`-based routing already selects (rules-based or
  ChatGPT harness), matching production/mobile behavior.
- **FR1.4**: The CLI shall support an optional `--engine rules|harness` flag
  that overrides the default engine selection, so either path can be
  exercised on demand without changing environment variables.

### FR2 — Response content
The CLI's output for a turn shall include, when applicable to the utterance:
appointment context, ride options, and any pending-approval state — never a
silently-completed booking or send action.

### FR3 — Approval checkpoints are never auto-approved
The system shall print/return any `requires_approval` decision from the
existing policy engine (`evaluateToolCall`) as an explicit pending-approval
result in the CLI output. This matches current pipeline behavior exactly —
**no new interactive approval-granting mechanism is introduced** by this issue
(confirmed via interview Q3); a human still grants approval through whatever
existing/future channel does so today.

### FR4 — Failed-tool output shape
When a tool call resolves to a stub/failure outcome (e.g. `book_ride`
returning `not_implemented`, or `find_ride_options` returning no options), the
CLI shall surface this as a retry/handoff-shaped response rather than a bare
error or silent empty result. This issue surfaces the shape only — real tool
implementations remain scoped to issue #7 (confirmed via interview Q4).

### FR5 — Audit trail
Every tool invocation triggered through the playground shall continue to be
recorded in the existing audit log via the unchanged `invokeTool` pipeline.
The playground's own CLI output does not need to duplicate audit entries
inline; the audit trail remains queryable separately via the existing
`GET /audit` endpoint (confirmed via interview Q7).

### FR6 — Seeded demo context
The playground shall use the existing seeded "Maria" persona data
(`packages/shared/src/seed.ts`) as its default demo actor/session context, per
the issue's "Use seeded Maria context" scope line.

## Non-Functional Requirements

### NFR1 — Test coverage for the new entry point
The playground CLI shall ship with at least one automated, integration-style
test that runs a representative utterance through the pipeline and asserts on
the shape of the response (appointment context / ride options / pending
approval / retry-handoff), consistent with the team's affirmed test-after
posture (confirmed via interview Q6). No numeric coverage floor applies.

### NFR2 — No regressions
`pnpm typecheck && pnpm test` shall continue to pass for the whole workspace
after this change, per the project's existing Definition of Done
(`AGENTS.md`).

## Constraints

- Must reuse the existing `invokeTool` → `evaluateToolCall` → audit pipeline
  exactly as-is; must not introduce a parallel path that bypasses policy
  evaluation or audit logging (project Forbidden rule: "NEVER let a tool
  execute without first going through `evaluateToolCall`").
- Must live inside `apps/api` per this repo's "one layout" convention
  (confirmed via interview Q2) — no new top-level package or app.
- No new HTTP endpoints are required; the CLI wraps the existing
  `POST /conversation/turn` / `POST /tools/:name` routes (confirmed via
  interview Q1).
- Any new shared types this issue needs (if the CLI's own request/response
  shaping requires new contracts) go in `packages/shared` first, per the
  project's build-order convention.

## Assumptions

- The existing `POST /conversation/turn` and `POST /tools/:name` endpoints
  already provide the functional surface this issue needs; the work is
  primarily a thin CLI wrapper, not new backend business logic. (Confirmed
  by the human via interview Q1 — not a residual assumption to revisit.)
- "Print or return" in the issue's acceptance criteria is satisfied by
  human-readable stdout output from a CLI command; no separate
  machine-readable output format (e.g. `--json`) is required unless a later
  stage's design finds one useful.
- The CLI runs against a locally-running `apps/api` process (`pnpm dev:api`
  or similar) rather than spawning/managing the server itself — consistent
  with how the mobile app and any manual `curl` testing already work.

## Out of Scope

- Real implementations of `find_ride_options` / `book_ride` — tracked
  separately in issue #7, which this issue explicitly does not block on and
  is not blocked by.
- Any interactive human-in-the-loop mechanism for *granting* approval from
  the CLI itself — today's pipeline has no such mechanism for any client,
  and this issue does not add one (see FR3).
- Any iOS/mobile UI changes — this issue exists specifically to unblock
  testing *before* screens exist (issue's own "Why").
- Standing up CI or a linter — tracked as a separate, general adoption
  decision from Practices Discovery, not scoped to this specific issue.
- Printing audit-log entries inline in the playground's own output — the
  audit trail stays reachable via the existing separate `GET /audit`
  endpoint (see FR5).

## Open Questions

- **Exact `--engine` flag values and CLI argument shape** — `rules` / `harness`
  is a reasonable default naming, but the exact flag/argument parsing
  approach (a dedicated CLI arg parser vs. hand-rolled) is left to Functional
  Design / the architect stage.
- **Exact retry/handoff payload shape** — FR4 establishes the requirement
  that failed tools surface a retry/handoff shape; the precise JSON/CLI
  presentation of that shape is left to Functional Design.
- **Test runner invocation for the new CLI test** — whether the new
  integration test lives alongside `apps/api/src/*.test.ts` (matching the
  existing co-located convention) is assumed but not explicitly reconfirmed;
  Functional Design should follow the existing `*.test.ts` co-location
  convention unless a reason emerges not to.
