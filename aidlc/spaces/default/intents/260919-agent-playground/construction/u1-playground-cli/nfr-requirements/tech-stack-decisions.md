# Tech Stack Decisions — U1: PlaygroundCli

No new tech stack choices. Reuses the existing monorepo stack: TypeScript,
Node (via `tsx`, matching `apps/api`'s existing run pattern), pnpm. No new
CLI-arg-parsing library is required for the small surface (one positional
arg + one optional flag) — Code Generation may use plain `process.argv`
parsing or the lightest existing convention in `apps/api`, per the team's
"convention over new dependencies" default.
