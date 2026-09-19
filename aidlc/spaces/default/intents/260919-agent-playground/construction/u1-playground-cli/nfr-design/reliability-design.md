# Reliability Design — U1

Design: wrap the HTTP call and argument parsing in a top-level try/catch at
the CLI entry point; on any caught error, print a clear message and exit
non-zero (BR1.3) rather than letting an uncaught exception print a stack
trace. No retry logic (a manually-run CLI — the operator re-runs it).
