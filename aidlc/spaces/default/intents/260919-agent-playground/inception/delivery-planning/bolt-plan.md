# Bolt Plan — Text/HTTP Agent Playground

A Bolt is one build pass over a piece of work, ending in something that
runs. There is one Bolt here, covering the single Unit of Work.

## Bolt 1 — PlaygroundCli (walking skeleton)

- **Units**: U1 (PlaygroundCli)
- **Walking skeleton**: Yes, in implementation style — thin, minimal code
  proving the pipeline end-to-end — not in scope: all of FR1-FR6 ship in
  this Bolt (confirmed with the human; nothing deferred).
- **Definition of Done**: `pnpm playground "<utterance>"` runs against a
  local `apps/api`; a read-only utterance returns appointment context; a
  write/consequential utterance (e.g. booking a ride) returns an explicit
  pending-approval result, never a silent booking; a stub-tool outcome
  (e.g. `book_ride`) returns a retry/handoff-shaped message; `--engine`
  overrides the conversation engine; exit code is 0 for any completed turn
  and non-zero only for a genuine operational failure; `pnpm typecheck && pnpm test`
  pass, including a new integration-style test per NFR1.
- **Confidence hypothesis**: The existing conversation/tool/policy pipeline
  can be exercised end-to-end from a CLI without the mobile UI — using the
  issue's own example utterance, appointment/ride/pending-approval content
  all appear correctly, and a stub-tool failure surfaces the retry/handoff
  shape.
- **Expected demo**: Run the issue's example ("Please get me a ride to my
  doctor tomorrow.") and show the appointment lookup, ride options, and
  pending-approval result in one terminal session.
