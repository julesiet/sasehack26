<!-- INVARIANT: examples are single-line HTML comments so a fresh template parses to total=0 (MEMORY_EMPTY). Do NOT un-comment or split across lines. t100 guards this. -->
> This file is kept up to date automatically while the stage runs. Add observations at the review step, not by editing here directly.

## Interpretations
<!-- example: 2026-05-29T10:14:32Z — chose REST over GraphQL; the consuming team only needs CRUD, revisit if subscriptions land -->
- 2026-09-19T21:20:13Z — when a new component's only dependency is an existing, unchanged part of the system (not a database/third-party service), declared that existing part as a real component in the catalogue (marked explicitly "not new work, not re-decomposed here") rather than filing it under external_dependencies, so depends_on/dependents stays a genuine graph edge Units Generation can trust. Reversed an earlier draft that had done the latter, after an architecture review caught it.
- 2026-09-19T21:20:13Z — the reviewer's review file twice failed the strict markdown-table parser for pure formatting reasons (unescaped `|` inside a backticked cell, then a self-incremented Iteration number not matching the request) even though its substantive conclusion (both prior findings resolved) was correct both times. After the stage's one-iteration + one-retry advisory budget was exhausted, recorded the terminal NOT-READY fallback receipt as the protocol requires, but still relayed the reviewer's actual verified conclusion to the human at the gate rather than letting the fallback's generic "review did not complete" message misrepresent the real content as unreviewed.

## Deviations
<!-- example: 2026-05-29T10:14:32Z — skipped the optional caching layer the stage prose suggested; the dataset is small enough that it adds risk -->

## Tradeoffs
<!-- example: 2026-05-29T10:14:32Z — picked TDD over BDD this run; the team is unit-first and the domain is well-understood -->

## Open questions
<!-- example: 2026-05-29T10:14:32Z — confirm the retention window with compliance before the next stage hardens the schema -->
