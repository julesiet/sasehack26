**Collaborator:** aidlc-developer-agent

## Contribution

Independent inspection of `packages/shared/src/`, `apps/api/src/`, and
`apps/mobile/src/` (source read directly, not just the lead's citations),
cross-checked against `code-structure.md` and `technology-stack.md`. Scope:
naming conventions, layer/module boundaries, error handling patterns, file
organization, code-style conventions.

### Naming conventions

- **Files**: kebab-case for multi-word TypeScript modules
  (`invoke-tool.ts`, `session-store.ts`, `audit-log.ts`, `load-env.ts`);
  single lowercase word where the module name is already one word
  (`composio.ts`, `conversation.ts`, `policy.ts`, `tools.ts`). React
  components use PascalCase `.tsx` (`ComposerPill.tsx`, `SeniorScreen.tsx`,
  `SunOrb.tsx`). Hooks follow the `useXxx.ts` convention
  (`useKasamaConversation.ts`). No exceptions found across the 20+ source
  files read in `apps/api/src`, `packages/shared/src`, and `apps/mobile/src`.
- **Factory + singleton pattern**: every stateful or side-effecting module
  exports a `create<Thing>()` factory (`createSessionStore`,
  `createElevenLabsTranscriber`, `createElevenLabsSpeaker`, `createApp`) that
  returns the implementation, **and** a default singleton built from that
  factory under the un-prefixed name (`sessionStore`, `transcriber`,
  `speaker`, `app`). This is applied consistently in `session-store.ts`,
  `speech.ts`, `composio.ts`, and `app.ts`/`index.ts` — it is what makes
  dependency injection for tests possible (`createApp({ transcribe, speak,
  composio, complete })` in `app.test.ts`) while routes use the plain
  singleton. Not called out in the lead's draft; worth naming explicitly as
  a pattern for new modules to follow.
- **Types vs. constants**: types are PascalCase (`SessionState`,
  `PolicyDecision`, `ConversationPhase`); true constants are
  SCREAMING_SNAKE_CASE (`POLICY_TABLE`, `HIGH_RISK_ACTIONS`,
  `MAX_RECORDING_MS`, `DEFAULT_KASAMA_VOICE_ID`); enum-like value sets use a
  lowercase-plural `as const` array paired with a derived
  `type X = (typeof x)[number]` (see `actors`/`Actor`,
  `policyActions`/`PolicyAction`, `policyRequirements`/`PolicyRequirement` in
  `packages/shared/src/policy.ts`) — a deliberately repeated idiom, not a
  one-off.
- **Custom error classes**: PascalCase, suffixed `Error`, named for the
  exact failure condition rather than a generic base class
  (`SttNotConfiguredError`, `TtsNotConfiguredError`,
  `ComposioNotConfiguredError` in `apps/api/src/speech.ts` and
  `composio.ts`).

### Layer / module boundaries

- Confirms the lead's shared → api → mobile characterization, with two
  structural points worth adding:
  1. `packages/shared` has **zero I/O and zero non-`zod` runtime
     dependency** — this is a structurally enforced boundary (there is
     nothing else in the dependency graph to violate it with), not just an
     observed convention.
  2. `apps/api/src/app.ts` route handlers are uniformly thin: parse → call
     one delegate function → shape the HTTP response. All four
     tool-invocation code paths (`/tools/:name` directly, plus both
     conversation engines `conversation.ts` and `harness.ts`) converge on
     the single `invokeTool()` function in `invoke-tool.ts` rather than each
     re-implementing policy/audit/session wiring. This single-chokepoint
     pattern is the structural mechanism behind the "every tool call must be
     policy-gated" mandated rule in `discovered-rules.md` — worth stating
     explicitly as the *implementation* of that rule, not just the rule
     itself.
  3. On mobile, screens are presentational only; all conversation/audio
     state lives in the one hook (`useKasamaConversation.ts`), and all HTTP
     calls are isolated in `src/lib/api.ts`. No screen or component reaches
     into `@kasama/api` or performs a `fetch` directly.
- **One coupling worth flagging** (not in the lead's draft): `apps/api/src/session-store.ts`
  directly imports and calls `auditLog.list()` (see `eventsFor()`) to build
  its `SessionView` projection, coupling the session layer to the audit
  layer's storage rather than receiving audit events as data. Minor at this
  scale, but a future unit of work that changes audit storage (e.g., moves
  it to a database) will need to touch `session-store.ts` too — worth a
  one-line note in `ARCHITECTURE.md` or `CONVENTIONS.md` if the team wants
  to preserve looser coupling going forward.

### Error handling patterns

Two distinct, layer-specific error-handling idioms coexist, and this split
is consistent enough to be a real convention, not noise:

1. **Errors-as-values on the request/policy path**: `packages/shared`'s
   `evaluateAction`/`evaluateToolCall` never throw for an expected business
   outcome — they return a `PolicyDecision { allowed, reason, summary }`.
   Input validation throughout `invoke-tool.ts` and `app.ts` uses Zod's
   `.safeParse()` (returns `{success, data|error}`), not `.parse()` (which
   throws), specifically at points where a failure is an expected,
   user-facing outcome rather than a bug.
2. **Typed exceptions for provider/config failures**: `apps/api`'s external
   client modules (`speech.ts`, `composio.ts`) throw purpose-named error
   classes (`SttNotConfiguredError`, etc.) for "not configured" states,
   caught by `instanceof` in the route handler and mapped to specific HTTP
   codes (501 not-configured, 502 upstream failure, 400 bad input). This
   mapping is duplicated near-identically across four route handlers
   (`/speech/transcribe`, `/speech/speak`, `/composio/connect`,
   `/composio/execute`), each repeating the same
   `error instanceof Error ? error.message : "..."` fallback — a real, if
   minor, DRY gap (a shared `mapProviderError(error, notConfiguredType)`
   helper would remove ~20 duplicated lines) not mentioned in the lead's
   draft.
3. Every route wraps `c.req.json()` / `c.req.parseBody()` in its own
   try/catch to turn a parse throw into a structured 400 — consistent
   "fail fast, respond structured" at every HTTP boundary, matching the
   Construction-phase guardrail on error handling at integration
   boundaries.
4. **Gap**: there is no global Hono error-handling middleware (no
   `app.onError(...)`). Each route catches its own errors independently;
   an unexpected throw in a route with no try/catch today (e.g.
   `GET /sessions/:sessionId`, `GET /audit`) would surface as an unhandled
   500 with none of the structured `{error, summary}` envelope the other
   routes use. Worth flagging as a concrete gap against the Construction
   guardrail ("errors must be surfaced to the caller ... not silent
   failures") — not fatal for a hackathon demo, but should be named as a
   known gap rather than silently inherited if this becomes a standing
   codebase.

### File organization

- Confirms the lead's and CodeKB's characterization: one file per contract
  domain in `packages/shared/src`, one file per concern in `apps/api/src`
  (route table separate from orchestration, provider clients separate from
  business logic), thin presentational screens in `apps/mobile/src`.
- Independently confirmed via directory listing: **every** test file
  (`*.test.ts`, 12 total across `apps/api/src` and `packages/shared/src`)
  sits immediately beside its source file with a matching basename, with
  zero exceptions — no test lives in a separate `tests/` or `__tests__/`
  tree anywhere in the repo.

### Code-style conventions

- Zod schema and its derived TS type are declared adjacently in the same
  file (schema first, type second), consistently across every file in
  `packages/shared/src` — this pairing, not just "Zod at the boundary" in
  isolation, is the actual repo convention worth documenting.
- Sparse but consistent single-line `/** ... */` JSDoc comments are used
  specifically to explain *why*, not *what* (e.g., the UTC-midnight date
  coercion comment in `invoke-tool.ts`, the clarification-budget comment in
  `session-store.ts`) — this matches the Construction-phase guardrail on
  documenting non-obvious logic and is worth naming as an existing strength
  to preserve, not just a gap to fill.
- Double-quoted strings, semicolons, ~2-space indentation, trailing commas
  in multiline literals — observed consistently despite the confirmed
  absence of Prettier/ESLint config. This reinforces (does not contradict)
  the lead's "no linter/formatter configured" finding, but it's worth
  stating explicitly that style is *consistent in practice* today — a
  generic linter/formatter adoption should capture these existing idioms
  (naming, factory+singleton, schema-then-type pairing, error-class style)
  rather than just applying stock rules, or risk churn-only diffs across
  a codebase that is already internally consistent.

## Positions

- AGREE: "No linter or formatter is configured anywhere in the repo" — independently confirmed by reading every source file's style directly; no `.eslintrc*`/`.prettierrc*` and no `lint`/`format` script anywhere.
- AGREE: The build-order mandated rule (shared types/policy → API behavior → iOS UI) — confirmed structurally: `packages/shared` has no dependency on `apps/api` or `apps/mobile`, and the "contracts-first" pattern is real, not aspirational.
- AGREE: Tests co-located as `*.test.ts` beside the unit under test — independently confirmed via directory listing with zero exceptions.
- OBJECT: The draft's Code Style section states the absence of tooling but doesn't capture that code style is nonetheless highly consistent in practice (naming idioms, factory+singleton pattern, schema-then-type pairing) — losing this observation risks the team adopting a stock linter config that produces churn instead of one that encodes these existing, load-bearing idioms.
- OBJECT: The draft doesn't mention the split error-handling idiom (result objects for policy/validation outcomes in `packages/shared` vs. thrown typed error classes for provider/config failures in `apps/api` clients) — this is a real convention future Code Generation units need to follow consistently, and it should be captured in `team-practices.md` under Code Style, not left implicit.
- OBJECT: The draft doesn't flag the missing global Hono error-handling middleware (`app.onError`) as a gap — two routes (`/sessions/:sessionId`, `/audit`) have no try/catch and would 500 without the structured envelope every other route returns; this is a concrete, evidenced gap against the Construction-phase error-handling guardrail and should be surfaced for the interview alongside the linter/CI gaps already flagged.
