# Units Generation — Clarifying Questions

Created: 2026-09-19T21:21:31Z

Domain Design produced exactly one new component (`PlaygroundCli`) with a
single dependency on an existing, unchanged component (`KasamaApiService`).
This is a textbook single-unit case (fewer than 5 stories, one component,
no independent deploy/test boundary). Confirming the approach before
generating artifacts.

## Q1 — Unit boundary

A. One unit covering `PlaygroundCli` — matches the domain design 1:1, no further decomposition needed
B. Split further — describe why below
X. Other (please specify)

[Answer]: A. One unit covering `PlaygroundCli` — matches the domain design 1:1, no further decomposition needed

## Q2 — Unit kind

`unit-of-work.md` needs a `kind` tag: `service` | `spec` | `ui` | `packaging` | `library`. `PlaygroundCli` is a runnable CLI script (its own entry point, invoked as `pnpm playground`), not a long-running server, not a UI, not a contract-only spec, and not a pure library with no standalone runtime.

A. `service` — closest fit: it's a deployed/runnable executable, even though it's short-lived rather than long-running (unlike the existing HTTP API service)
B. `library` — it's just a script invoked via pnpm, not really "deployed"
C. Not sure — recommend based on which construction design-artifact matrix best fits a CLI tool
X. Other (please specify)

[Answer]: A. `service` — closest fit: it's a deployed/runnable executable, even though it's short-lived rather than long-running (unlike the existing HTTP API service)
