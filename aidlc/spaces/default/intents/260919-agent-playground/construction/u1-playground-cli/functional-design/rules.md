# Business Rules — U1: PlaygroundCli

```yaml
rules:
  - id: BR1.1
    statement: The CLI defaults to whichever conversation engine the existing MODEL_API_KEY-based routing already selects, unless overridden by --engine.
    category: policy
    applies_to: engine selection
    trigger: CLI invocation
    logic: "IF --engine is not provided THEN use the server's default routing ELSE use the --engine value"
    violation_behaviour: n/a (default, not a violation)
    source: FR1.3, FR1.4
  - id: BR1.2
    statement: An invalid --engine value is an operational failure, not silently ignored.
    category: validation
    applies_to: CLI argument parsing
    trigger: --engine provided with a value other than "rules" or "harness"
    logic: "IF --engine value NOT IN {rules, harness} THEN print an error naming the valid values AND exit non-zero AND do not contact the API"
    violation_behaviour: Process exits non-zero before any HTTP request is made.
    source: FR1.4
  - id: BR1.3
    statement: Exit code reflects whether the CLI completed its job, not whether the underlying tool call "succeeded."
    category: policy
    applies_to: process exit code
    trigger: Every CLI run
    logic: "IF the turn completed (including pending-approval or retry-handoff outcomes) THEN exit 0 ELSE IF an operational failure occurred (API unreachable, bad argument) THEN exit non-zero (single code, not differentiated by failure type)"
    violation_behaviour: n/a (this rule defines the mapping, not a violation)
    source: FR3, FR4, functional-design Q2
  - id: BR1.4
    statement: The CLI echoes what was sent before printing the response.
    category: policy
    applies_to: output formatting
    trigger: Every CLI run that reaches the point of sending a request
    logic: "Print 'Sending: \"<utterance>\" (actor: <actor>, engine: <engine>)' before the response body"
    violation_behaviour: n/a
    source: FR2
```

## Summary

| Rule | Category | What it governs |
|---|---|---|
| BR1.1 | policy | Default vs. overridden engine selection |
| BR1.2 | validation | Rejecting an invalid `--engine` value before any network call |
| BR1.3 | policy | Mapping turn outcomes to process exit codes |
| BR1.4 | policy | Echo-before-response output ordering |

No new authorization, calculation, or entity-constraint rules — those all
remain in the existing, unchanged policy engine (`evaluateToolCall`), which
this unit calls but does not reimplement.
