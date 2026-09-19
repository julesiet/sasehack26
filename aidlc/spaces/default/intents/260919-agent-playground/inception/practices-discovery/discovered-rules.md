# Discovered Rules — sasehack26 (Kasama)

> Final integration (Step 5). Only rules stated as genuine hard constraints
> in the evidence (not soft preferences or stylistic suggestions) are listed
> here. Source is cited for every rule. All three independent reviews
> (quality, developer, devsecops) confirmed these rules without proposing
> additions or removals to the Mandated/Forbidden lists themselves — see
> "Notes on a known gap against an existing rule" below for the one
> cross-cutting observation that touches this list without adding to it.

## Mandated

- ALWAYS run `pnpm typecheck` and `pnpm test` and have both pass before
  considering agent work done (`AGENTS.md` → "Definition of done for agent
  work", items 4).
- ALWAYS update the canonical docs (`AGENTS.md`, `ARCHITECTURE.md`,
  `docs/CONVENTIONS.md`, `docs/SAFETY.md`, `README.md`) in the **same PR**
  when stack, folders, tools, routes, policy, run commands, or demo scope
  change (`AGENTS.md` → "Shared context is mandatory").
- ALWAYS define new/changed types and policy in `packages/shared` first, then
  API behavior in `apps/api`, then iOS UI last — and only build the UI slice
  if the issue is not `blocked:design` (`docs/CONVENTIONS.md` → "New
  feature").
- ALWAYS put new tools/permissions through `packages/shared` **and**
  `docs/SAFETY.md` **and** `ARCHITECTURE.md` when a new tool or permission is
  added (`docs/CONVENTIONS.md` → "Docs").
- ALWAYS place tests next to the unit under test as `*.test.ts`, using vitest
  (`docs/CONVENTIONS.md` → "Code style").
- ALWAYS validate input with Zod at every system/API boundary
  (`docs/CONVENTIONS.md` → "Code style"; `Construction Phase` guardrail:
  "Validate and sanitize all inputs at system boundaries").
- ALWAYS require a human `approvalToken` from an actor other than `model` to
  book Uber, send a message, or spend money (`AGENTS.md` → "Safety
  (non-negotiable)"; `docs/SAFETY.md` → Table).
- ALWAYS require a caretaker-or-doctor actor plus an approval token to change
  medication or a medical plan (`docs/SAFETY.md` → Table).
- ALWAYS require explicit consent and a recipient on an allow-list before
  sharing health information (`docs/SAFETY.md` → Table).
- ALWAYS write an audit event for every tool invoke, recording who asked,
  what was proposed, the approval outcome, whether execution was attempted,
  and the outcome (`docs/SAFETY.md` → "Audit").
- ALWAYS phrase care-related signals as "worth reviewing," never as a medical
  conclusion or diagnosis (`docs/SAFETY.md` → "Language"; `AGENTS.md` →
  "Safety").
- ALWAYS keep senior-facing screen text at ≥28pt and tap targets at ≥68pt
  (`AGENTS.md` → "Mobile").
- ALWAYS keep the encoded policy table (`packages/shared/src/policy.ts`) and
  the human-readable policy doc (`docs/SAFETY.md`) in agreement; if they
  disagree, fix both (`docs/SAFETY.md` → header; `AGENTS.md` → "Shared
  context is mandatory").
- ALWAYS use only Expo Go–compatible packages in `apps/mobile`, installed via
  `npx expo install` (`docs/CONVENTIONS.md` → "Code style"; `AGENTS.md` →
  "Mobile").
- ALWAYS keep stub tool results valid against their Zod schema rather than
  fabricating a successful outcome (`docs/CONVENTIONS.md` → "Tools": "Never
  return a fake 'booked' Uber that skipped policy").

## Forbidden

- NEVER let the `model` actor self-approve a tool call, even if it presents
  an approval token (`AGENTS.md` → "Safety"; `docs/SAFETY.md` → "Actors":
  `model_cannot_self_approve`).
- NEVER diagnose a medical condition (`AGENTS.md` → "Safety"; `docs/SAFETY.md`
  → Table: "Diagnose | Never").
- NEVER make an unsupervised medication change (`AGENTS.md` → "Safety").
- NEVER implement full EHR, unsupervised payments, or an Android client
  (`AGENTS.md` → "Issues": "Do not implement diagnosis, full EHR,
  unsupervised payments, or Android").
- NEVER build a Next.js/web client — iOS only, per explicit MVP scope
  (`AGENTS.md` → "Product": "iOS only. Android is out of scope. No Next.js /
  web client for MVP."; `docs/CONVENTIONS.md` → "One layout": "Do not add ...
  a Next.js app, or Android targets").
- NEVER create a second contracts package (e.g. `packages/types`) alongside
  `packages/shared` (`docs/CONVENTIONS.md` → "One layout").
- NEVER add native speech-to-text modules to the mobile app, and never run
  `expo prebuild` (`AGENTS.md` → "Mobile"; `docs/CONVENTIONS.md` → "Code
  style").
- NEVER create parallel/forked context docs (`NOTES.md`, `CONTEXT.md`,
  `AGENT.md`, per-agent READMEs, `docs/architecture-v2.md`, chat-export
  markdown) — extend the five canonical docs instead (`AGENTS.md` → "Shared
  context is mandatory"; `docs/CONVENTIONS.md` → "Docs").
- NEVER commit secrets — use `.env.example` keys only
  (`docs/CONVENTIONS.md` → "Code style": "No secrets in git; use
  `.env.example` keys only").
- NEVER commit, push, switch the user's branch, or close a GitHub issue
  unless the user explicitly asked (`AGENTS.md` → "Git").
- NEVER let a tool execute without first going through
  `evaluateToolCall`/policy — tools stay narrow and policy-gated
  (`docs/CONVENTIONS.md` → "Tools": "Kasama asks; `evaluateToolCall`
  decides.").

## Notes on exclusions

Soft/aspirational items were deliberately **excluded** from the lists above
because they read as preference or convention rather than a stated hard
constraint, for example: "no CSS-in-JS or UI kit" (a styling preference, not
phrased as a rule with consequence), and the general naming guidance to call
the product "Kasama" and not "the AI"/"the agent" in user-facing copy (a
terminology convention, not a build/process constraint). These may still be
useful to record in `team-practices.md` (Code Style) but do not belong under
Mandated/Forbidden as originally scoped.

## Notes on a known gap against an existing rule

The devsecops review independently confirmed that `apps/api/src/composio.ts`
and its `/composio/connect` / `/composio/execute` routes validate input with
Zod but do **not** route through `invokeTool`/`evaluateToolCall`/`auditLog`
— meaning Composio-executed Gmail actions currently do not satisfy the
"ALWAYS write an audit event for every tool invoke" (Mandated) and "NEVER
let a tool execute without first going through `evaluateToolCall`"
(Forbidden) rules above in practice, even though those rules remain
correctly stated. `ARCHITECTURE.md` self-documents this gap.

Per the human interview (Q7), this is **accepted as known technical debt for
now**, not escalated to a new or restated hard rule, given the project is a
local/LAN-only demo today — see `evidence.md` for the full framing and the
unauthenticated-endpoint finding it sits alongside. The two rules above are
not weakened or qualified by this note; the gap is recorded here so a future
stage that revisits Composio integration or deployment readiness has a
direct pointer to the inconsistency and its accepted-debt status, without
having to re-discover it.
