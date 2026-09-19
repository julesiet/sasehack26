# Refined Mockups — Clarifying Questions (Developer-Experience Spec)

Created: 2026-09-19T21:02:40Z

This intent has no visual UI (issue #13 explicitly excludes "any designed
conversation UI"), so per this stage's own guidance ("For non-UI: create API
developer experience specification"), these questions shape the CLI's
developer experience rather than screens/wireframes. Visual-design questions
(component library, responsive breakpoints, WCAG level) don't apply and are
answered as N/A below rather than asked.

## Q1 — Command syntax

`requirements.md` established `pnpm playground "<utterance>"` as the shape and
an optional `--engine rules|harness` override flag. Any other flags/arguments
needed?

A. Just the utterance argument and `--engine` — nothing else needed
B. Also add a flag to override the default actor (e.g. `--actor senior|caretaker`) instead of always using the seeded Maria/senior context
C. Also add a `--json` flag for machine-readable output, in addition to the default human-readable text
D. More than one of the above — describe below
X. Other (please specify)

[Answer]: A. Just the utterance argument and `--engine` — nothing else needed

## Q2 — Output format

The default/primary output when no `--json` flag (if added) is used:

A. Plain, human-readable multi-line text (e.g. "Appointment: ...", "Ride options: ...", "Pending approval: ...")
B. A single structured block (e.g. pretty-printed JSON) even by default
C. Not sure — recommend the format that best matches the issue's `curl`/CLI acceptance example
X. Other (please specify)

[Answer]: A. Plain, human-readable multi-line text (e.g. "Appointment: ...", "Ride options: ...", "Pending approval: ...")

## Q3 — Exit codes and error/success shape

What should the CLI's process exit code and console shape look like for different outcomes?

A. Exit 0 for a completed turn (even if it includes a pending-approval or retry/handoff result — those are valid outcomes, not process failures); non-zero only for a genuine operational failure (e.g. API unreachable, malformed argument)
B. Exit non-zero whenever the result isn't a fully "successful" tool outcome (e.g. pending-approval or retry/handoff also exit non-zero)
C. Not sure — recommend based on typical CLI conventions
X. Other (please specify)

[Answer]: A. Exit 0 for a completed turn (even if it includes a pending-approval or retry/handoff result — those are valid outcomes, not process failures); non-zero only for a genuine operational failure (e.g. API unreachable, malformed argument)

## Q4 — Echoing input before the response

Should the CLI echo back what it's doing before printing the result (e.g. "Sending: 'Please get me a ride to my doctor tomorrow.' (actor: Maria, engine: rules)") or just print the final response?

A. Echo the utterance/actor/engine first, then the response — helps confirm what was actually sent, especially useful once `--engine`/`--actor` overrides exist
B. Just print the final response, nothing before it
X. Other (please specify)

[Answer]: A. Echo the utterance/actor/engine first, then the response — helps confirm what was actually sent, especially useful once `--engine`/`--actor` overrides exist

## Q5 — Visual design system / accessibility / responsive design

These don't apply to a CLI tool with no visual surface. Confirming explicitly rather than silently skipping (per the Requirements Analysis reviewer's note that this should be stated, not assumed):

A. Confirmed N/A — no design-system mapping, accessibility checklist, or responsive breakpoints apply to this CLI
X. Other (please specify — if you believe something here does apply, explain)

[Answer]: A. Confirmed N/A — no design-system mapping, accessibility checklist, or responsive breakpoints apply to this CLI
