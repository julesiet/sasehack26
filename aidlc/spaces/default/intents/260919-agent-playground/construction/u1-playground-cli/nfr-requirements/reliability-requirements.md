# Reliability Requirements — U1: PlaygroundCli

No formal availability target (it's a manually-run local dev tool, not a
running service). Reliability requirement is behavioral, per FR3/FR4/BR1.3:
the CLI must never crash uncaught on an operational failure — it catches
API-unreachable and bad-argument cases explicitly and exits with a clear
message and non-zero code (BR1.3), rather than an unhandled exception.
