# Interaction Specification — `pnpm playground` CLI

Adapted from `.claude/knowledge/aidlc-design-agent/component-spec-template.md`
for a CLI "component" rather than a UI component: States → CLI run outcomes,
Props/Inputs → CLI arguments/flags, Usage Example → actual invocations.
Responsive Behaviour and Accessibility sections from the template are N/A for
a CLI and are addressed instead in `accessibility-checklist.md` and
`design-system-mapping.md` with explicit rationale, per this stage's
questions Q5.

## `pnpm playground`

| Field | Value |
|---|---|
| Component | `pnpm playground` CLI command |
| Description | Runs a single utterance through the existing conversation/tool pipeline (`POST /conversation/turn`) and prints the result, without the mobile UI |
| Category | developer tool (CLI) |
| Location | `apps/api` (new script + `pnpm playground` command, per requirements.md's Constraints) |

### Arguments

| Argument | Type | Required | Default | Description |
|---|---|---|---|---|
| `<utterance>` | string (positional) | yes | — | The text utterance to send, e.g. `"Please get me a ride to my doctor tomorrow."` |
| `--engine` | `rules` \| `harness` | no | whatever `MODEL_API_KEY`-based routing already selects | Overrides which conversation engine handles this turn (FR1.4) |

No other flags are in scope for this issue (confirmed via Q1 — no `--actor`
override, no `--json` output mode). The playground always uses the seeded
Maria/senior demo actor as its default identity (FR6).

### Run outcomes ("states")

| Outcome | Description | Exit code |
|---|---|---|
| Tool result returned | A read-only tool call resolved and its result is printed (e.g. appointment lookup) | 0 |
| Pending approval | A write/consequential tool call resolved to `requires_approval`; printed as an explicit pending state, never auto-approved (FR3) | 0 |
| Retry/handoff | A stub tool call resolved to a "not implemented"/empty outcome; printed with a retry/handoff-shaped message (FR4) | 0 |
| Operational failure | The API process is unreachable, or the CLI's own argument parsing fails | non-zero |

Per Q3: exit code reflects whether the *CLI itself* completed its job, not
whether the underlying tool call "succeeded" in a product sense —
pending-approval and retry/handoff are both valid, expected outcomes of a
working pipeline and exit 0.

### Output shape

Per Q2 and Q4, the default (and, per Q1, only) output format is
human-readable plain text with two parts, in order:

1. **Echo line** — what was sent: the utterance, the actor used, and the
   resolved engine (`Sending: "<utterance>" (actor: <actor>, engine: <engine>)`).
2. **Response body** — the turn's content in the shape FR2 requires:
   appointment context / ride options / pending-approval / retry-handoff
   info, as applicable to what the utterance triggered.

No `--json` or structured-output mode is in scope for this issue (Q1).

### Usage Examples

```
pnpm playground "What's my next appointment?"
pnpm playground --engine harness "Please get me a ride to my doctor tomorrow."
```

See `mockups.md` for full example sessions covering each run outcome.
