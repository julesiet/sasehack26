# Logical Components (NFR-driven) — U1

No new logical components beyond `PlaygroundCli` itself (domain-design
`components.md`). No NFR here drove a new sub-component (e.g. a cache, a
circuit breaker) — the design is a single-file CLI entry point with a
try/catch boundary (reliability-design.md).
