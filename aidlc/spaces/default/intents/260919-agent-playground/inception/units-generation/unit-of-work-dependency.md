# Unit Dependency DAG — Text/HTTP Agent Playground

This stage describes topology only — it does not pick a build order or
critical path (that is Delivery Planning's job, using this DAG as input).

## Dependency Graph (prose)

There is exactly one Unit (`U1 — PlaygroundCli`) and no other new Units, so
there are no inter-unit dependency edges to declare. `U1`'s only dependency
is on the existing, unchanged `KasamaApiService` component
(`aidlc/spaces/default/intents/260919-agent-playground/inception/domain-design/components.md`)
— that is a call to already-existing infrastructure, not a Unit this stage
produces or sequences.

## Integration Points

`U1` integrates with `KasamaApiService` via the existing, unchanged
`POST /conversation/turn` HTTP endpoint. No new integration points are
introduced between Units, since there is only one Unit.

## Parallel Development Opportunities

Not applicable — a single-Unit decomposition has nothing to parallelize
against.

## Machine-Readable Edge Block

```yaml
units:
  - name: u1-playground-cli
    kind: service
    depends_on: []
```

Well-formedness: one declared unit, unique name, empty `depends_on` (no
other Unit exists to depend on), trivially acyclic. `kind: service` matches
`unit-of-work.md`'s Unit table.
