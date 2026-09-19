# Performance Design — U1

No design needed beyond a synchronous HTTP request/response (one call per
invocation, no caching, no batching) — matches the informal &lt;100ms CLI
overhead expectation in `nfr-requirements/performance-requirements.md`.
