# Practices Discovery — Interview Questions

Created: 2026-09-19T20:33:17Z
Project: sasehack26 (Kasama) — brownfield

These questions cover only what the lead's draft and the three independent
reviews (quality, developer, devsecops) could not establish from the repo
itself. Evidence found is noted inline as a suggested default, but your
answer is what counts — evidence shows behavior, not necessarily intent.

## Q1 — Branching & code review (Way of Working)

I looked at the git history and found short-lived, per-person/per-topic
branches merged into `main` through real GitHub pull-request merges (not
squashed) — no `develop` or `release` branch exists. What I couldn't tell
from the repo: whether a pull request needs someone else's review/approval
before it can merge (there's no branch-protection config checked into the
repo to confirm this either way).

A. Keep what's there today: short branches → PR → merge to `main`, and require at least one review before merging
B. Same branching, but no formal review requirement — anyone can merge their own PR
C. Something more structured (e.g. required checks, multiple reviewers) — describe below
D. This isn't something worth formalizing right now — skip it
X. Other (please specify)

[Answer]: X. Other — Work solely on this branch and I will manage PRs and merges. (Branching pattern stays as observed — short branches → PR → merge to main; the human handles all PR creation/merging themselves, not the workflow/agent.)

## Q2 — Walking skeleton (Walking Skeleton)

Build a thin end-to-end slice first? A walking skeleton is a minimal version
that runs the whole way through, built first to prove the pieces connect
before the real features go in. I found real evidence this already happened
once here — an early commit explicitly scaffolded the API and mobile app
"so the team can run before designs land," plus an issue-label workflow
(`blocked:design` / `no-design-needed`) that treats unblocked scaffolding
work as separate from design-gated work. But nothing in the docs states this
as a standing rule for every new feature — it may have just been how this
project happened to start.

A. Yes — treat it as standing practice: build a thin working slice first for future substantial features, gated and approved before other work continues
B. No — that was specific to getting this project off the ground, not a rule going forward
C. Case-by-case — decide per feature whether a skeleton pass is worth it
X. Other (please specify)

[Answer]: A. Yes — treat it as standing practice: build a thin working slice first for future substantial features, gated and approved before other work continues

## Q3 — Testing approach (Testing Posture)

What I found: tests are written after the corresponding code (not
test-first/TDD), live next to the file they test, and are required to pass
before work is considered done — but there's no minimum coverage percentage
enforced anywhere, and no coverage-measurement tool is even installed.

A. That's correct and intentional — keep writing tests after the code, no formal coverage number required
B. Keep test-after, but start enforcing a coverage floor (recommend a percentage below)
C. Move toward writing tests before the code (test-first / TDD) for new work going forward
D. Formalize acceptance criteria as given/when/then scenarios (a structure sometimes called BDD) even while keeping test-after for the underlying code
X. Other (please specify)

If B, what coverage floor (e.g. 80%)? ________

[Answer]: A. That's correct and intentional — keep writing tests after the code, no formal coverage number required

## Q4 — Mobile app test coverage (Testing Posture)

The mobile app (`apps/mobile`) currently has zero automated tests, including
its most complex piece of logic — the voice-conversation state machine
(the code that tracks whether the app is idle, listening, thinking,
speaking, waiting for clarification, etc.). Everything there is verified by
hand today.

A. Yes, closing this gap matters — expect new/changed mobile logic (especially that state machine) to come with tests going forward
B. Not a priority right now — hand-testing is fine for the mobile app for now
C. Something in between — describe what should and shouldn't be covered
X. Other (please specify)

[Answer]: A. Yes, closing this gap matters — expect new/changed mobile logic (especially that state machine) to come with tests going forward

## Q5 — Deployment (Deployment)

This is the area with the least evidence in the repo: there's no CI/CD
config, no environment setup (staging/production), and the app currently
runs entirely locally (in-memory data, no persistence, LAN-only). I'm not
assuming any deployment approach applies here without you confirming it.

A. No deployment is in scope right now — this stays a local/demo project for now
B. We do want to move toward a deployed environment — describe the target (e.g. staging first, who approves production, etc.)
C. Not sure yet — flag it as an open question and revisit later
X. Other (please specify)

[Answer]: A. No deployment is in scope right now — this stays a local/demo project for now

## Q6 — Linting, formatting, and CI (Code Style)

Two tooling gaps showed up that the org-level defaults for this workspace
normally expect: there's no linter or code formatter configured anywhere
(ESLint/Prettier or similar), and nothing runs `pnpm typecheck && pnpm test`
automatically on push or PR — that check currently only happens if a person
remembers to run it by hand.

A. Yes to both — add a linter/formatter (ESLint + Prettier fit this TypeScript/React Native stack) and a CI pipeline that runs typecheck + test on every push/PR
B. Add the linter/formatter, but hold off on CI for now
C. Add CI, but hold off on the linter/formatter for now
D. Leave both as-is for now — not a priority yet
X. Other (please specify)

[Answer]: A. Yes to both — add a linter/formatter (ESLint + Prettier fit this TypeScript/React Native stack) and a CI pipeline that runs typecheck + test on every push/PR

## Q7 — Security gaps found during review (cross-cutting)

The devsecops review turned up two things worth flagging directly to you,
separate from tooling gaps:
1. The API's `/audit` and `/sessions/:sessionId` endpoints have no
   authentication or ownership check today — anyone who can reach the
   server can read any session's audit trail or state.
2. The Gmail integration (`/composio/*`) currently executes actions
   directly, bypassing the same policy/consent/audit pipeline every other
   tool call goes through — something `ARCHITECTURE.md` itself already
   flags as a known gap, but it currently contradicts the project's own
   stated rule that every tool call must be policy-gated.

A. Both are real gaps — treat closing them as a required/forbidden practice going forward (e.g. "NEVER ship an unauthenticated data-read endpoint," "ALWAYS route tool execution through the policy/audit pipeline")
B. Acceptable for now given this is a local/LAN-only demo — note them as known technical debt, not a hard rule yet
C. Split — treat one as urgent and the other as acceptable for now (say which)
X. Other (please specify)

[Answer]: B. Acceptable for now given this is a local/LAN-only demo — note them as known technical debt, not a hard rule yet
