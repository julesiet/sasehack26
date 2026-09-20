# Conventions

Where to put work so every agent sees the same system.

## One layout

```text
apps/mobile/src/screens/    iOS screens (app Home unchanged; Senior Home / Chat history list + thread / Tasks; caretaker dashboard)
apps/mobile/src/components/ Reusable pieces (orb, sun bowl, composer pill, chat bubble, ride option cards, ride status card, confirmation card, medication reminder card, hospital appointment card, compact tab bar, caretaker dashboard cards)
apps/mobile/src/hooks/      Conversation state machine (record → transcribe → turn → speak)
apps/mobile/src/lib/        API client
apps/mobile/src/theme.ts    Design tokens
apps/api/src/               Hono app, tool invoke, conversation turn, text playground, harness (ChatGPT), approvals, speech, Composio session, in-memory session + audit
packages/shared/src/        Zod + policy + audit + session types (source of truth)
.github/workflows/          GitHub Actions (`ci.yml` runs typecheck + tests)
AGENTS.md                   Coding-agent operating manual
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

## Testing without iOS

Coding agents should use the text playground when they change intent, tools, policy, approvals, or Uber. Do not wait for designed UI or the Simulator.

```sh
pnpm playground
# or POST /playground after pnpm dev:api
```

See [AGENTS.md](../AGENTS.md#test-with-the-playground-no-ios). The playground never auto-approves book / send / spend.

## Code style

- TypeScript strict
- Zod at the boundary
- React Native `StyleSheet`; colors/type/sizes from `apps/mobile/src/theme.ts`
- Expo Go–compatible packages only (`npx expo install`); no `expo prebuild`
- Tests next to the unit (`*.test.ts`) with vitest
- No secrets in git; use `.env.example` keys only

## Tools

Keep tools narrow. Kasama asks; `evaluateToolCall` decides.

Stub results must still be valid Zod. Never return a fake “booked” Uber that skipped policy.
