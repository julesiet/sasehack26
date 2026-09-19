# Accessibility Checklist — Text/HTTP Agent Playground

## N/A — confirmed explicitly, with CLI-appropriate equivalents noted

This intent has no visual/screen-reader-facing UI, so standard WCAG
criteria (contrast ratio, ARIA roles, focus management, screen-reader
announcements) do not apply. Confirmed explicitly with the human at this
stage's Q5 rather than silently omitted, per the Requirements Analysis
reviewer's R-01 finding.

## CLI-appropriate equivalents (informational, not a formal requirement)

Since the audience is developers running a terminal command, not end users
with the product's existing accessibility needs (senior/caretaker personas),
the closest equivalents to "accessibility" for this tool are plain CLI
hygiene — not formally required by this issue, but worth keeping in mind
during implementation:

- Output should be plain text, not reliant on color alone to convey meaning
  (e.g. don't signal "pending approval" only via a colored prompt with no
  text label — `mockups.md`'s example sessions already print an explicit
  `Pending approval:` label, not just a visual cue).
- Output should remain readable when piped or redirected (no interactive
  TTY-only rendering required for the plain-text default per Q2).

Neither of these is a new requirement — they're already satisfied by the
plain-text, label-first output shape specified in `interaction-spec.md` and
`mockups.md`.
