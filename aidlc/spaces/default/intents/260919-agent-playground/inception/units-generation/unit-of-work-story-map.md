# Story Map — Text/HTTP Agent Playground

User Stories was skipped for this intent (issue #13 is developer tooling
with no end-user-facing surface — see
`aidlc/spaces/default/intents/260919-agent-playground/inception/user-stories/user-stories-assessment.md`).
No `stories.md` exists, so this map uses functional requirement IDs from
`requirements.md` instead, consistent with how Domain Design's traceability
also fell back to FR IDs.

## Requirement → Unit Mapping

| Requirement | Implementing Unit | Directory |
|---|---|---|
| FR1 (CLI entry point) | U1 | u1-playground-cli |
| FR1.1 (utterance argument) | U1 | u1-playground-cli |
| FR1.2 (calls existing HTTP API) | U1 | u1-playground-cli |
| FR1.3 (default engine routing) | U1 | u1-playground-cli |
| FR1.4 (`--engine` override) | U1 | u1-playground-cli |
| FR2 (response content) | U1 | u1-playground-cli |
| FR3 (approval checkpoints, never auto-approved) | U1 | u1-playground-cli |
| FR4 (failed-tool retry/handoff shape) | U1 | u1-playground-cli |
| FR5 (audit trail) | — | Not realized by U1; already satisfied by the existing, unchanged `KasamaApiService` audit pipeline (see domain-design `traceability.json`) |
| FR6 (seeded demo context) | U1 | u1-playground-cli |

## Cross-Cutting Requirements

None. Every in-scope requirement is implemented entirely within the single
Unit; there is no cross-unit concern to coordinate since only one Unit
exists.

## Implementation Order Within U1

Not applicable at this granularity — a single Unit has no internal
ordering to sequence at the Units Generation level. Any internal
implementation sequencing (e.g. argument parsing before HTTP call before
output formatting) is a Functional/Code Generation concern, not a
units-generation decision.

## Coverage Verification

- Every non-N/A requirement (FR1, FR1.1-FR1.4, FR2, FR3, FR4, FR6) is
  assigned to U1. ✓
- FR5 is explicitly accounted for as N/A (realized by existing,
  out-of-scope infrastructure, not this stage's new work) rather than
  silently omitted. ✓
- U1 has requirements assigned (not an orphan Unit with no traceable
  purpose). ✓
