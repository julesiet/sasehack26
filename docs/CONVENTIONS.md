# Conventions

Where to put work so every agent sees the same system.

## One layout

```text
apps/mobile/src/screens/    iOS screens (placeholders until design-ready)
apps/api/src/               Hono app, tool invoke, in-memory audit
packages/shared/src/        Zod + policy + audit types (source of truth)
AGENTS.md                   Agent operating manual
ARCHITECTURE.md             System map
docs/                       Extra canonical docs only (this folder)
```

New feature:

1. Types / policy first in `packages/shared`
2. API behavior in `apps/api`
3. iOS UI last, and only if the issue is not `blocked:design`
4. Update `ARCHITECTURE.md` + `AGENTS.md` if the map or commands changed

Do not add a second `packages/types`, a Next.js app, or Android targets.

## Docs

Agent-facing facts go in the canonical files listed in [AGENTS.md](../AGENTS.md).

- New run command → `README.md` and `AGENTS.md`
- New package or route → `ARCHITECTURE.md`
- New tool or permission → `packages/shared` **and** [SAFETY.md](SAFETY.md) + `ARCHITECTURE.md`
- Do not add `docs/architecture-v2.md` or chat-export markdown into the repo

## Code style

- TypeScript strict
- Zod at the boundary
- React Native `StyleSheet` until designs exist
- Tests next to the unit (`*.test.ts`) with vitest
- No secrets in git; use `.env.example` keys only

## Tools

Keep tools narrow. The model asks; `evaluateToolCall` decides.

Stub results must still be valid Zod. Never return a fake “booked” Uber that skipped policy.
