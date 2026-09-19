# Observability Design — U1

Design: stdout is the only output channel (echo line + response body, per
functional-spec.md). No structured logging, no new metrics — the existing
audit log remains the durable record (FR5), unaffected by this unit.
