# Performance Requirements — U1: PlaygroundCli

No new performance targets. This is a manually-invoked, single-shot local
CLI (one utterance per run) with no concurrent-user or throughput profile —
the existing API it calls already has whatever performance characteristics
it has, unchanged by this unit. NFR: the CLI itself should not add
noticeable latency beyond the network round-trip to the local API (informal
target: CLI overhead &lt;100ms; not load-tested, not a formal SLA).
