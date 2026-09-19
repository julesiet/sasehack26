# AGENTS.md

Operating instructions for coding agents (Cursor, Claude, Copilot, humans pairing on this repo).

## Naming

**Kasama** is the product AI. In UI, voice, issues, and docs, call it Kasama — not “the AI”, “the assistant”, or “the agent”.

In this file, “coding agent” means someone working on the codebase. Do not call Kasama “the agent” in user-facing copy.

## Shared context is mandatory

All agents must use the **same** project context. Do not invent a parallel story of the repo.

Canonical files (edit these in place; do not replace them with new names):

| File | What it is |
|---|---|
| [AGENTS.md](AGENTS.md) | How to work here |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System shape, packages, APIs |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Where new code and docs go |
| [docs/SAFETY.md](docs/SAFETY.md) | Permission policy (must match `packages/shared/src/policy.ts`) |
| [README.md](README.md) | How a human runs the app |

If you change stack, folders, tools, routes, policy, run commands, or demo scope, **update these same files in the same PR**. Do not leave the new fact only in a commit message, issue comment, or a new markdown file.

Do **not** create extra `NOTES.md`, `CONTEXT.md`, `AGENT.md`, or per-agent READMEs. Add a section here or in `ARCHITECTURE.md` instead.

Code contracts live in `packages/shared`. Docs describe them; they do not fork them.

## Product

Kasama is a voice-first, care-aware iOS product. Seniors talk to Kasama; families see explainable activity. Ride booking is **Uber only**.

iOS only. Android is out of scope. No Next.js / web client for MVP.

## Repo

```text
apps/mobile          Expo / React Native iOS
apps/api             Hono on Node — http://localhost:3001
packages/shared      Zod tools, policy, audit types
```

pnpm workspaces + Turborepo. Node 20. Package manager `pnpm@9.15.9`.

## Commands

```sh
pnpm install
pnpm dev:api          # API — keep running in its own terminal
pnpm ios              # Expo → iOS Simulator (own terminal)
pnpm typecheck
pnpm test
```

`pnpm dev:api` and `pnpm ios` are long-running. Do not chain them in one terminal. Port 3001 / 8081 in use means that process is already up — do not start a second copy.

There is no product website. `http://localhost:3001` is the API. The app is the Simulator.

## Current API

- `GET /` — service hint
- `GET /health` — `{ ok: true, service: "kasama-api" }`
- `POST /tools/:name` — validate → policy → audit → stub execute
- `GET /audit` — `{ events: [...] }` in-memory, cleared on process restart

Tools: `get_appointment`, `find_ride_options`, `book_ride`, `notify_caretaker`.

Calendar and Uber are **stubs**. Policy and audit are real. Live Uber is later (`#14` / `#7`).

## Safety (non-negotiable)

Kasama may request tools. The harness decides. Encode policy in `packages/shared/src/policy.ts`, not comments.

- Book Uber / send message / spend money → human `approvalToken`, actor ≠ `model`
- Model cannot self-approve even with a token
- No diagnosis. No unsupervised medication changes
- Care language is “worth reviewing,” never a medical conclusion

See [docs/SAFETY.md](docs/SAFETY.md).

## Issues

Repo: [julesiet/sasehack26](https://github.com/julesiet/sasehack26).

- `can-start-now` + `no-design-needed` — safe to implement
- `blocked:design` / `needs-design` — do not build designed UI
- `design-ready` — mockups landed; UI work may start
- Designers start at [#20](https://github.com/julesiet/sasehack26/issues/20)
- Design done comment: `Design done — unblocks #N` plus flip `blocked:design` → `design-ready`

Do not implement diagnosis, full EHR, unsupervised payments, or Android.

## Git

- Only commit when the user asks
- Do not push unless asked
- Do not switch the user’s branch unless they asked
- Do not close GitHub issues unless asked

## Definition of done for agent work

1. Code matches existing layout (`docs/CONVENTIONS.md`)
2. Shared types/policy updated in `packages/shared` if you touched contracts
3. Canonical docs updated if behavior or structure changed
4. `pnpm typecheck` and `pnpm test` pass
