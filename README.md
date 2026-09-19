# Kasama

Kasama is a voice-first, care-aware companion that helps older adults complete everyday tasks while giving families early, explainable signals when something changes.

Agents: start at [AGENTS.md](AGENTS.md). System map: [ARCHITECTURE.md](ARCHITECTURE.md).

iOS only. Android is out of scope.

## Architecture

```text
Kasama (Expo / React Native, iOS)
  Senior mode: voice, Uber ride cards, spoken + tap confirmation
  Caretaker mode: activity, consent, care signals
        ↓
Kasama API (Hono / TypeScript)
  Intent, planning, permissions, tools, session, audit log
```

```text
apps/mobile     Expo iOS app (senior + caretaker placeholders)
apps/api        Hono agent API
packages/shared Zod schemas and inferred types
```

## Run

Needs a Mac, Xcode, Node 20, and pnpm 9.

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install
```

API:

```sh
pnpm dev:api
```

Listens on `http://localhost:3001`. Check `GET /health`.

iOS Simulator:

```sh
pnpm ios
```

The Simulator can reach the API at `http://localhost:3001`. Tap **Dev** on the home screen to open the Senior and Caretaker placeholders.

## Env

Copy `.env.example` into `apps/api/.env` and `apps/mobile/.env` when you add keys.

```text
PORT=3001
EXPO_PUBLIC_API_URL=http://localhost:3001
ELEVENLABS_API_KEY=
MODEL_API_KEY=
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
COMPOSIO_API_KEY=
```
