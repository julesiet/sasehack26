# Functional Specification — U1: PlaygroundCli

## Workflow: Run a single utterance

1. Parse CLI arguments: positional `<utterance>` (required), `--engine` (optional).
2. If `--engine` is present and not `rules`/`harness`: apply BR1.2, exit non-zero.
3. Resolve actor: the seeded Maria/senior demo actor (fixed default; no override in scope).
4. Print the echo line (BR1.4).
5. Send `POST /conversation/turn` to the existing API with the utterance, actor, and resolved engine (BR1.1).
   - If the request fails to reach the API: print an operational-failure message, exit non-zero (BR1.3).
6. Format the response per its content:
   - Appointment/ride content present → print it.
   - A `requires_approval` decision present → print it as an explicit pending-approval result (never proceed as if approved).
   - A stub/failed tool outcome present → print it as a retry/handoff-shaped message.
7. Exit 0 (BR1.3) — any of the outcomes in step 6 is a completed turn.

No state machine: this is a single linear request/response flow per
invocation, not a long-lived stateful process. No lifecycle-entity
transitions to specify (no entities — see `entities.md`).

## Entity-Relationship Diagram

Not applicable — `entities.md` declares no entities.

## Rules Summary

See `rules.md` (BR1.1–BR1.4).
