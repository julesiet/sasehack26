# Observability Requirements — U1: PlaygroundCli

No new logging/metrics/tracing infrastructure. The CLI's own stdout output
(echo line + response, per BR1.4/functional-spec.md) is its observability
surface for a human operator watching it run. Every tool invocation it
triggers continues to be recorded in the existing, unchanged audit log
(FR5) — that remains the durable observability trail, queryable via the
existing `GET /audit`.
