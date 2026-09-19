# Developer Experience Specification — Text/HTTP Agent Playground

This intent has no visual UI (issue #13 explicitly excludes "any designed
conversation UI"). Per this stage's non-UI guidance, this document plays the
role "mockups" would for a UI feature: concrete example sessions showing
exactly what a developer sees when running the CLI, derived from
`requirements.md` (FR1–FR6) and the confirmed developer-experience answers in
`refined-mockups-questions.md`.

## Example Session 1 — Happy path (read-only lookup)

```
$ pnpm playground "What's my next appointment?"
Sending: "What's my next appointment?" (actor: senior/maria-demo, engine: rules)

Appointment: Dr. Chen — Tomorrow, 10:00 AM (Cardiology follow-up)

$ echo $?
0
```

## Example Session 2 — Pending approval (write/consequential action)

```
$ pnpm playground "Please get me a ride to my doctor tomorrow."
Sending: "Please get me a ride to my doctor tomorrow." (actor: senior/maria-demo, engine: rules)

Appointment: Dr. Chen — Tomorrow, 10:00 AM (Cardiology follow-up)
Ride options: 2 found (Economy ~15 min, Comfort ~12 min)

Pending approval: book_ride requires approval from an actor other than
"model" before it will execute. No booking has been made.

$ echo $?
0
```

This is FR3's requirement made concrete: the tool call result is printed as
an explicit pending-approval state, never a silent booking, and the process
still exits 0 because a pending-approval outcome is a valid, successful
result of running the CLI (confirmed via Q3 in this stage's questions file)
— it is not an operational failure.

## Example Session 3 — Stub tool / retry-handoff shape

```
$ pnpm playground "Book the ride now, I already approved it."
Sending: "Book the ride now, I already approved it." (actor: senior/maria-demo, engine: rules)

Tool: book_ride
Result: not implemented yet
Retry/handoff: this action isn't wired to a live booking provider (tracked
in issue #7). No retry will succeed until that lands — hand off to a human
if this was expected to work today.

$ echo $?
0
```

This is FR4 made concrete: a stub-tool outcome is surfaced with an explicit
retry/handoff shape rather than a bare error or silent empty result.

## Example Session 4 — Engine override

```
$ pnpm playground --engine harness "What's my next appointment?"
Sending: "What's my next appointment?" (actor: senior/maria-demo, engine: harness)

Appointment: Dr. Chen — Tomorrow, 10:00 AM (Cardiology follow-up)

$ echo $?
0
```

Same utterance, explicit engine override (FR1.4) — demonstrates testing both
conversation engines from one command without changing environment
variables.

## Example Session 5 — Operational failure (not a tool-call outcome)

```
$ pnpm playground "What's my next appointment?"
Sending: "What's my next appointment?" (actor: senior/maria-demo, engine: rules)

Error: could not reach the API at http://localhost:3001 — is `pnpm dev:api`
running?

$ echo $?
1
```

This is the one case that exits non-zero (per Q3): a genuine operational
failure (the API process isn't up), distinct from any tool-call outcome the
pipeline itself produces.
