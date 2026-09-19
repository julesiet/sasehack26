# Risk & Sequencing Rationale — Text/HTTP Agent Playground

## Sequencing

Trivial: one Unit, one Bolt — no ordering decision to make. The single
Bolt matches Units Generation's dependency DAG exactly (no edges to
respect or deviate from).

## Approach

Walking-skeleton-first in implementation style (Cockburn): build thin,
prove the pipeline end-to-end first, rather than over-engineering the CLI
before confirming it talks to the real API correctly. This is a style
choice within the one Bolt, not a scope split — all of FR1-FR6 ship in it
(confirmed with the human; see `delivery-planning-questions.md`).

## Biggest risk

The CLI silently drifting from real API behavior if it ever bypassed HTTP
(already ruled out in Requirements Analysis/Domain Design — it calls the
existing endpoint, not a parallel code path) or mis-formatting the
pending-approval/retry-handoff states so they read as errors or silent
failures instead of the explicit results FR3/FR4 require. Both are
addressed by the Bolt's Definition of Done and NFR1's test coverage.
