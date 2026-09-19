# Domain Design — Clarifying Questions

Created: 2026-09-19T21:09:34Z

This is a small, additive change: a CLI wrapper around already-existing
components (the conversation/tool pipeline). My read is there's exactly one
new logical building block to add — a thin CLI component with no new
business logic and no new entities, matching how `@kasama/mobile` is
already described as "thin over the API, no business logic of its own."
Confirming that read before I write the component catalogue.

## Q1 — New component boundary

I'd model this as one new component, tentatively named `PlaygroundCli`:
thin, calls the existing `POST /conversation/turn` HTTP endpoint, formats
the response for terminal output. It owns no entities and contains no
business logic of its own (same shape as the mobile client's relationship
to the API). Does that match your intent, or should this be split further
or scoped differently?

A. Yes — one thin `PlaygroundCli` component, no new entities, no new business logic
B. Split into more than one component — describe below
C. Not sure — recommend based on the existing codebase's patterns
X. Other (please specify)

[Answer]: A. Yes — one thin `PlaygroundCli` component, no new entities, no new business logic

## Q2 — Component name

What should the new component be called in `components.md` (PascalCase, used in diagrams and traceability)?

A. `PlaygroundCli`
B. `AgentPlayground`
C. Something else — specify below
X. Other (please specify)

[Answer]: A. `PlaygroundCli`
