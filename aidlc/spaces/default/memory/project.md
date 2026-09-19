# Project-Level Rules

> Project-specific specialisation and corrections. Loaded after `org.md` and
> `team.md` as strict-additive guidance; contradictions with broader policy
> are rejected. Populated by practices-discovery and the self-learning loop.
>
> Use sparingly: most teams don't need a project layer. Reach for it
> only when this specific project needs stable, durable guidance beyond the
> team practice (for example, package-specific release checks or an additional
> regression suite for a legacy component).

## Way of Working

<!-- Project-specific specialisation. Example: -->
<!-- This monorepo requires package-scoped branch names and a package owner -->
<!-- review in addition to the team's normal merge policy. -->

## Walking Skeleton

<!-- Project-specific specialisation. Example: -->
<!-- The walking skeleton must exercise the legacy service adapter as well -->
<!-- as the new service boundary. -->

## Testing Posture

<!-- Project-specific specialisation. -->

## Change Control

<!-- Project-specific. Mode: strict or relaxed. Strict here holds for every intent and cannot be changed from chat. -->

## Deployment

<!-- Project-specific specialisation. -->

## Code Style

<!-- Project-specific specialisation. -->

## Tech Stack

<!-- Technology choices locked for this project. -->

## Decided

<!-- Decisions made in earlier stages that should not be re-asked. -->
<!-- Format: DECIDED: [decision] (Stage [slug], [date]) -->

## Scope Overrides

<!-- Custom scope rules for this project. -->

## Forbidden

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: NEVER [behavior] (affirmed [date]) -->
<!-- Example: NEVER throw exceptions across service layer boundaries (affirmed 2026-05-17) -->

- NEVER let the `model` actor self-approve a tool call, even if it presents an approval token (`AGENTS.md` → "Safety"; `docs/SAFETY.md` → "Actors": `model_cannot_self_approve`). (affirmed 2026-09-19)
- NEVER diagnose a medical condition (`AGENTS.md` → "Safety"; `docs/SAFETY.md` → Table: "Diagnose | Never"). (affirmed 2026-09-19)
- NEVER make an unsupervised medication change (`AGENTS.md` → "Safety"). (affirmed 2026-09-19)
- NEVER implement full EHR, unsupervised payments, or an Android client (`AGENTS.md` → "Issues": "Do not implement diagnosis, full EHR, unsupervised payments, or Android"). (affirmed 2026-09-19)
- NEVER build a Next.js/web client — iOS only, per explicit MVP scope (`AGENTS.md` → "Product": "iOS only. Android is out of scope. No Next.js / web client for MVP."; `docs/CONVENTIONS.md` → "One layout": "Do not add ... a Next.js app, or Android targets"). (affirmed 2026-09-19)
- NEVER create a second contracts package (e.g. `packages/types`) alongside `packages/shared` (`docs/CONVENTIONS.md` → "One layout"). (affirmed 2026-09-19)
- NEVER add native speech-to-text modules to the mobile app, and never run `expo prebuild` (`AGENTS.md` → "Mobile"; `docs/CONVENTIONS.md` → "Code style"). (affirmed 2026-09-19)
- NEVER create parallel/forked context docs (`NOTES.md`, `CONTEXT.md`, `AGENT.md`, per-agent READMEs, `docs/architecture-v2.md`, chat-export markdown) — extend the five canonical docs instead (`AGENTS.md` → "Shared context is mandatory"; `docs/CONVENTIONS.md` → "Docs"). (affirmed 2026-09-19)
- NEVER commit secrets — use `.env.example` keys only (`docs/CONVENTIONS.md` → "Code style": "No secrets in git; use `.env.example` keys only"). (affirmed 2026-09-19)
- NEVER commit, push, switch the user's branch, or close a GitHub issue unless the user explicitly asked (`AGENTS.md` → "Git"). (affirmed 2026-09-19)
- NEVER let a tool execute without first going through `evaluateToolCall`/policy — tools stay narrow and policy-gated (`docs/CONVENTIONS.md` → "Tools": "Kasama asks; `evaluateToolCall` decides."). (affirmed 2026-09-19)

## Mandated

<!-- Populated by practices-discovery affirmation gate. -->
<!-- Format: ALWAYS [behavior] (affirmed [date]) -->
<!-- Example: ALWAYS use Result<T,E> for fallible operations in service layer (affirmed 2026-05-17) -->

- ALWAYS run `pnpm typecheck` and `pnpm test` and have both pass before considering agent work done (`AGENTS.md` → "Definition of done for agent work", items 4). (affirmed 2026-09-19)
- ALWAYS update the canonical docs (`AGENTS.md`, `ARCHITECTURE.md`, `docs/CONVENTIONS.md`, `docs/SAFETY.md`, `README.md`) in the **same PR** when stack, folders, tools, routes, policy, run commands, or demo scope change (`AGENTS.md` → "Shared context is mandatory"). (affirmed 2026-09-19)
- ALWAYS define new/changed types and policy in `packages/shared` first, then API behavior in `apps/api`, then iOS UI last — and only build the UI slice if the issue is not `blocked:design` (`docs/CONVENTIONS.md` → "New feature"). (affirmed 2026-09-19)
- ALWAYS put new tools/permissions through `packages/shared` **and** `docs/SAFETY.md` **and** `ARCHITECTURE.md` when a new tool or permission is added (`docs/CONVENTIONS.md` → "Docs"). (affirmed 2026-09-19)
- ALWAYS place tests next to the unit under test as `*.test.ts`, using vitest (`docs/CONVENTIONS.md` → "Code style"). (affirmed 2026-09-19)
- ALWAYS validate input with Zod at every system/API boundary (`docs/CONVENTIONS.md` → "Code style"; `Construction Phase` guardrail: "Validate and sanitize all inputs at system boundaries"). (affirmed 2026-09-19)
- ALWAYS require a human `approvalToken` from an actor other than `model` to book Uber, send a message, or spend money (`AGENTS.md` → "Safety (non-negotiable)"; `docs/SAFETY.md` → Table). (affirmed 2026-09-19)
- ALWAYS require a caretaker-or-doctor actor plus an approval token to change medication or a medical plan (`docs/SAFETY.md` → Table). (affirmed 2026-09-19)
- ALWAYS require explicit consent and a recipient on an allow-list before sharing health information (`docs/SAFETY.md` → Table). (affirmed 2026-09-19)
- ALWAYS write an audit event for every tool invoke, recording who asked, what was proposed, the approval outcome, whether execution was attempted, and the outcome (`docs/SAFETY.md` → "Audit"). (affirmed 2026-09-19)
- ALWAYS phrase care-related signals as "worth reviewing," never as a medical conclusion or diagnosis (`docs/SAFETY.md` → "Language"; `AGENTS.md` → "Safety"). (affirmed 2026-09-19)
- ALWAYS keep senior-facing screen text at ≥28pt and tap targets at ≥68pt (`AGENTS.md` → "Mobile"). (affirmed 2026-09-19)
- ALWAYS keep the encoded policy table (`packages/shared/src/policy.ts`) and the human-readable policy doc (`docs/SAFETY.md`) in agreement; if they disagree, fix both (`docs/SAFETY.md` → header; `AGENTS.md` → "Shared context is mandatory"). (affirmed 2026-09-19)
- ALWAYS use only Expo Go–compatible packages in `apps/mobile`, installed via `npx expo install` (`docs/CONVENTIONS.md` → "Code style"; `AGENTS.md` → "Mobile"). (affirmed 2026-09-19)
- ALWAYS keep stub tool results valid against their Zod schema rather than fabricating a successful outcome (`docs/CONVENTIONS.md` → "Tools": "Never return a fake 'booked' Uber that skipped policy"). (affirmed 2026-09-19)

## Corrections

<!-- Project-specific corrections from human feedback. -->
<!-- Format: NEVER/ALWAYS [behavior] (learned [date]) -->
- For this intent, `sasehack26` is an unrecorded project-root repo -- omit `--repo` on all `codekb-*` and `log link` commands even though the codekb store path includes the repo name. (learned 2026-09-19) <!-- cid:260919-agent-playground:reverse-engineering:4ae8b8b4c94d494eb7ee89d6d3958eebea3e49904cda71695124b01b4f55f2ad -->
- When briefing the developer agent for Reverse Engineering's scan handoff, explicitly state the exact required heading strings and levels (`## Developer Code Scan Results`, `### Scan Coverage`) -- subagents may otherwise freelance a title/heading style that fails the pipeline's completion check. (learned 2026-09-19) <!-- cid:260919-agent-playground:reverse-engineering:ffb25c1e08f22100e1c563db12f64ce89884ed87f327c58797f6616f9bb5e707 -->
- When a human's free-text ("Other") reply to a structured question is unambiguous and complete, treat it as the final answer rather than looping back for a confirmatory follow-up round. (learned 2026-09-19) <!-- cid:260919-agent-playground:practices-discovery:6266d167a66f52b0a406c3ccfe682128a3c6b3f8277ab7b87c265b9c777d680e -->
- When the project's initial description is just a bare issue reference (e.g. "work on issue N"), resolve the git remote and use `gh issue view <N> --repo <owner/repo>` to pull the actual issue title/body/labels/dependencies before drafting clarifying questions, rather than asking the human to restate the issue. Also check linked dependency/blocking issues for closed/open status. (learned 2026-09-19) <!-- cid:260919-agent-playground:requirements-analysis:bc4da5746bfff9ba1218e6ff903643b6137d21149e5d9d8e8e714dcf2ea33d63 -->
- For a non-UI (CLI/API) issue at Refined Mockups, adapt the UI component-spec-template to a CLI shape (run outcomes -> States, arguments/flags -> Props, example terminal sessions -> mockups) instead of skipping the stage, and explicitly mark design-system-mapping.md/accessibility-checklist.md as N/A with stated rationale rather than omitting them. (learned 2026-09-19) <!-- cid:260919-agent-playground:refined-mockups:1a67194f815ad72cddaf2232a1dcad6ffef375d6a3fc274a3bef7f117b0bcdb5 -->
