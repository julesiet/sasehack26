# Units of Work — Text/HTTP Agent Playground

Single-unit decomposition, confirmed with the human (units-generation-questions.md
Q1-Q2 and the Step 4 plan approval): Domain Design produced exactly one new
component (`PlaygroundCli`), so there is exactly one Unit.

## Unit Table

| Unit ID | Directory | Name | Kind |
|---|---|---|---|
| U1 | u1-playground-cli | PlaygroundCli | service |

## U1 — PlaygroundCli

**Description**: A CLI entry point (`pnpm playground "<utterance>"`) that
sends a single text utterance through the existing conversation/tool
pipeline (`POST /conversation/turn`) and prints the result to the terminal,
without the mobile UI. Implements GitHub issue #13.

**Boundaries**: Owns only the CLI argument parsing, the HTTP request to the
already-existing, unchanged endpoint, and the terminal output formatting. It
does not own, modify, or re-implement any policy, tool-execution, or audit
logic — all of that remains in the existing `KasamaApiService` component
(domain-design's `components.md`), which this unit calls but does not build.

**Responsibilities** (from `components.md`):
- CLI argument parsing (utterance, `--engine`)
- Sending the HTTP request to the existing conversation-turn endpoint
- Formatting the turn response as human-readable terminal output
- Mapping operational failures (unreachable API, bad arguments) to a
  non-zero exit code

**Deployment model**: Standalone. Runs as a local CLI command
(`pnpm playground`) inside `apps/api`, invoked manually by a developer
against an already-running local API process (`pnpm dev:api`). Not deployed
anywhere itself — it is a developer tool, not a service with its own
runtime environment or endpoint.

**Relative complexity estimate**: S (small). One new file (or small set of
files) inside `apps/api`, no new entities, no new business logic, reuses an
existing endpoint's contract types from `packages/shared`.

**Unit kind**: `service` (confirmed via Q2) — the closest fit among the
five kinds for a standalone runnable executable, even though it is
short-lived per invocation rather than long-running like the existing API
server. This pulls it onto the construction design-artifact matrix
appropriate for a runnable unit rather than a pure library or spec.

**Implementation notes and constraints**:
- Must reuse `packages/shared`'s existing contract types for the
  conversation-turn request/response shape — no new shared types are
  expected, but if the `--engine` override or CLI-specific formatting needs
  a new type, it goes in `packages/shared` first per the project's
  established build order (`AGENTS.md` → "New feature").
- Must not alter `KasamaApiService`'s behavior, routes, or contracts.
- Automated test coverage is expected per `requirements.md` NFR1 (an
  integration-style test exercising a representative utterance through the
  pipeline).
