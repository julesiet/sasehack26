# Intent Capture & Framing — Questions

## Sources

- [desc] Initial description: "Can you work on issue #2 of the repo"
- [scope] Workflow-selected scope: `poc`.

## Q1. What business problem does seeding Maria's demo data solve, and why now?

Issue #2 ("Seed Maria's demo data") says the Kasama demo is Maria asking Kasama to book a ride to her doctor, and seeded context is what makes Kasama care-aware instead of a generic assistant. It sits in the "Phase 1: Foundation" milestone, alongside the just-merged app scaffold (issue #1).

A. It lets the Kasama assistant be demoed end-to-end (a real-feeling senior profile, appointment, and care signals) without live partner APIs, since those integrations don't exist yet — needed now because the scaffold (#1) just landed and the team wants a working demo path next.
B. It's mainly needed to validate the data schema design before building the agent harness — timing isn't urgent.
C. It's primarily to support automated testing infrastructure, not a demo.
D. Not yet defined.
X. Other (please specify)

[Answer]:

## Q2. Who is this seed data primarily for right now?

A. Internal team demoing the Maria/caretaker flow (e.g. to hackathon judges or stakeholders).
B. External beta users of the app.
C. Automated CI/test suites only.
D. Not yet defined.
X. Other (please specify)

[Answer]:

## Q3. What does "done" look like for this fixture data?

Issue #2's stated acceptance criteria: Kasama can load Maria without live partner APIs; the appointment data is enough to compute a 10:15 AM arrival target (15 minutes before a 10:30 AM appointment); caretaker and care-signal code can read the same fixtures.

A. Match issue #2's acceptance criteria exactly, as quoted above.
B. Just having some placeholder JSON is enough for now; exact computed values (like the 10:15 AM arrival target) don't matter yet.
C. Not yet defined.
X. Other (please specify)

[Answer]:

## Q4. Scope boundary confirmation

The workflow was started with the `poc` scope (minimal process: a light requirements pass, then straight to building and testing, no design/architecture ceremony). You separately told me to work ONLY on issue #2, and to stop and ask before doing any work that belongs to issue #1 (the app scaffold, which just landed) or any other issue.

A. Confirm both: `poc`'s minimal process fits, AND the product boundary is issue #2 only — if the fixture work turns out to need something from #1 or another issue, stop and ask first rather than expanding scope.
B. `poc` is fine, but I want to redefine the product boundary (describe it under Other).
C. Not yet defined.
X. Other (please specify)

[Answer]:
