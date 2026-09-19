# Architecture Decision Records — Text/HTTP Agent Playground

## ADR-001: Single thin CLI component, no new business logic

### Status
Accepted

### Date
2026-09-19

### Context
Issue #13 needs a way to exercise the existing conversation/tool/policy/audit
pipeline without the iOS UI. That pipeline (policy evaluation, tool
execution, audit logging) already exists and is unchanged by this issue —
confirmed in `requirements.md`'s Constraints ("must reuse the existing
`invokeTool` pipeline exactly as-is") and confirmed again directly with the
human in domain-design Q1. The only open design question was whether this
needs one component or more than one.

### Decision
Model this as exactly one new component, `PlaygroundCli`: a thin CLI process
that sends an utterance to the existing `POST /conversation/turn` endpoint
and formats the response for the terminal. It owns no entities and contains
no business logic — the same architectural shape as `@kasama/mobile`'s
existing relationship to `@kasama/api` (thin client, all decisions
server-side).

### Consequences

**Positive**
- No risk of duplicating or diverging from the existing policy/audit logic —
  the CLI can't drift from the pipeline's behavior because it doesn't
  reimplement any of it.
- Minimal surface area to review, test, and maintain (one component, no new
  entities, no new business rules).
- Matches an already-proven pattern in this codebase (the mobile client),
  so no new architectural style is introduced for the team to learn.

**Negative**
- If future work needs the CLI to do more (e.g. batch-run multiple
  utterances, or format richer diagnostic output), that logic would need a
  new decision then — this ADR only covers the current, deliberately narrow
  scope.

**Neutral**
- The CLI talks to the API over HTTP like any other client, not via a
  direct in-process function call — this was also confirmed via
  Requirements Analysis Q1 (CLI wraps the existing HTTP API) before this
  stage began, not re-litigated here.

### Alternatives Rejected

**Alternative: CLI calls conversation/tool logic in-process (bypassing HTTP)**
- Description: The CLI script would import and call the conversation-turn
  and tool-invocation functions directly within the same Node process,
  rather than making an HTTP request to a running API server.
- Pros: No dependency on a separately-running server process; potentially
  simpler to run in a single command.
- Cons: Rejected during Requirements Analysis (Q1) — the human explicitly
  chose the HTTP-wrapping approach so the CLI exercises the exact same code
  path production/mobile traffic hits, rather than a parallel path that
  could silently drift from the real request-handling behavior (route
  validation, middleware, etc.).

**Alternative: Split into a separate "formatter" component and a separate "HTTP client" component**
- Description: Decompose the CLI into two components — one responsible for
  building/sending the HTTP request, another for formatting the response.
- Pros: Slightly more granular separation of concerns.
- Cons: Rejected as over-decomposition for the scope of this issue — both
  responsibilities are small, always change together (a new CLI flag
  typically affects both request-building and output formatting), and
  splitting them would add indirection without a corresponding benefit at
  this size. Confirmed with the human at Q1 ("one thin component").

### References
- `requirements.md` — FR1-FR6, Constraints
- `domain-design-questions.md` — Q1, Q2
- `aidlc/spaces/default/codekb/sasehack26/architecture.md` — existing mobile-client-as-thin-consumer pattern this decision follows

## ADR-002: Model the existing API as a declared (existing) component, not an external dependency

### Status
Accepted

### Date
2026-09-19

### Context
An earlier draft of `components.md` modeled `PlaygroundCli`'s call to the
existing `POST /conversation/turn` endpoint as an `external_dependency`
(`kind: other`), on the reasoning that the API is "already-running
infrastructure" from the CLI's point of view. On reflection, this is a
modeling error: `component-inventory.md` and `architecture.md` describe
`@kasama/api` as an existing logical component in this same system (code
the team wrote, with its own business logic), not infrastructure like a
database or third-party API — the stage definition's `external_dependencies`
category is reserved for the latter. Filing it as external could mislead
Units Generation, which reads this catalogue to decide deployment topology,
into treating the existing API as outside the system's component graph.

### Decision
Declare a second component, `KasamaApiService`, representing the existing,
unchanged API — not as new work to be built, but solely so `PlaygroundCli`'s
`depends_on` edge is well-formed and traceable. `KasamaApiService`'s own
internal structure is explicitly out of scope for this domain-design pass
(it predates this framework's use on this repo and is not being
re-decomposed here); it exists in the catalogue only as the target of one
real dependency edge.

### Consequences

**Positive**
- Units Generation now reads an accurate dependency graph: `PlaygroundCli`
  genuinely depends on an existing component, not on undifferentiated
  "infrastructure."
- The Component Diagram's edge now matches its stated derivation rule
  (drawn from `depends_on`, not smuggled in via `external_dependencies`).

**Negative**
- The catalogue now contains one component (`KasamaApiService`) that isn't
  actually decomposed here — a reader could mistake its presence for a
  signal that its internals were analyzed in this pass, when they weren't.
  Mitigated by the explicit "not new work" note in its `summary`/`behaviour`
  fields and in the Rationale table.

**Neutral**
- This changes only how the existing API is *modeled* in this catalogue,
  not any actual runtime behavior — `KasamaApiService` remains completely
  unchanged.

### Alternatives Rejected

**Alternative: Keep `external_dependencies`, but add a note clarifying the modeling choice**
- Description: Leave the API as an `external_dependency` but add prose
  explaining that this category is being deliberately widened to also
  cover existing internal services.
- Pros: Avoids declaring a component whose internals aren't actually
  analyzed in this pass.
- Cons: Rejected because it would require every future stage/reader to
  remember a repo-specific exception to the stage definition's own
  vocabulary, rather than using the vocabulary as defined. Declaring
  `KasamaApiService` as a real (if undecomposed) component keeps the
  catalogue's categories meaning what the stage definition says they mean.

### References
- `requirements.md` — Constraints (reuse the existing pipeline as-is)
- `aidlc/spaces/default/codekb/sasehack26/component-inventory.md` — `@kasama/api` entry
