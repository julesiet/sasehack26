# Functional Design — Clarifying Questions (U1: PlaygroundCli)

Created: 2026-09-19T21:36:25Z

Requirements Analysis and Refined Mockups already pinned most behavior
(command syntax, output format, echo-first, exit-0-for-completed-turns).
Two small gaps remain for the business-rule level.

## Q1 — Invalid `--engine` value

If `--engine` is given a value other than `rules` or `harness` (e.g.
`--engine foo`), what should happen?

A. Operational failure — print an error naming the valid values and exit non-zero, without contacting the API
B. Fall back to the default engine (ignore the bad value) and proceed
X. Other (please specify)

[Answer]: A. Operational failure — print an error naming the valid values and exit non-zero, without contacting the API

## Q2 — Non-zero exit code granularity

`requirements.md` says "non-zero only for a genuine operational failure." Should every operational failure use the same exit code, or different codes per failure type?

A. Same code for all operational failures (e.g. exit 1) — keep it simple
B. Distinguish failure types (e.g. 1 = API unreachable, 2 = bad CLI argument) for scripting/CI use
X. Other (please specify)

[Answer]: A. Same code for all operational failures (e.g. exit 1) — keep it simple
