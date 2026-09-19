# Delivery Planning — Clarifying Questions

Created: 2026-09-19T21:25:49Z

There's exactly one Unit of Work (U1/PlaygroundCli), so this is naturally
one Bolt (one build pass over a piece of work, ending in something that
runs). The affirmed team practice already says a thin, gated end-to-end
slice is standard for substantial features — but with only one Bolt total,
there's no later feature-Bolt for a "skeleton" to precede. Confirming how
to treat that before writing the plan.

## Q1 — Walking skeleton framing

A. Not applicable — with only one Bolt, it's just "the Bolt," not a skeleton-then-features split; build it as the complete feature
B. Still apply it — treat this one Bolt as a minimal skeleton (bare CLI, one happy-path utterance) and expect a follow-up issue to round out the rest
C. Not sure — recommend based on what fits a single-Bolt plan
X. Other (please specify)

[Answer]: B, clarified — treated as a "skeleton" in the sense of minimal/thin implementation style, NOT scope deferral: all of FR1-FR6 ship in this one Bolt (confirmed in a follow-up round — see below). No requirements are pushed to a separate follow-up issue.

## Follow-up: Scope clarification
**Q**: The walking-skeleton answer (still treat as a skeleton) and the full-pipeline confidence hypothesis (Q2) were in tension, since this is the only Bolt in the plan and anything deferred would have no other Bolt to cover it. Build all of FR1-FR6 now, or defer some to a follow-up issue?
**A**: Build all of FR1-FR6 now — "skeleton" here means thin/minimal code, not deferred scope.

## Q2 — Confidence hypothesis

What should shipping this Bolt prove (the observable behavior it validates)?

A. That the existing conversation/tool/policy pipeline can be exercised end-to-end from a CLI without the mobile UI, using the issue's own example ("Please get me a ride to my doctor tomorrow.") — appointment context, ride options, and pending-approval all show up correctly, and a stub-tool failure shows the retry/handoff shape
B. Something narrower or different — describe below
X. Other (please specify)

[Answer]: A. That the existing conversation/tool/policy pipeline can be exercised end-to-end from a CLI without the mobile UI, using the issue's own example ("Please get me a ride to my doctor tomorrow.") — appointment context, ride options, and pending-approval all show up correctly, and a stub-tool failure shows the retry/handoff shape

## Q3 — Construction staffing

Team Formation was skipped for this scope, so by default I build every unit myself, one at a time, with you approving as we go. Any reason to change that for this single-unit Bolt?

A. No — build it here, one session, I approve as we go (the default)
B. Something else — describe below
X. Other (please specify)

[Answer]: A. No — build it here, one session, I approve as we go (the default)
