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

Listens on `http://localhost:3001` and on your LAN. Check `GET /health`. Poll a session with `GET /sessions/:sessionId` (omit `sessionId` on tool calls to use `default`).

Expo Go on a phone (same Wi-Fi as the Mac):

```sh
# apps/mobile/.env — this Mac's IP, not localhost
# ipconfig getifaddr en0
EXPO_PUBLIC_API_URL=http://192.168.x.x:3001
```

```sh
pnpm start
```

Or `pnpm dev` (API + Expo). Scan the QR in Expo Go. Restart Expo after changing `.env`.

iOS Simulator:

```sh
pnpm ios
```

The Simulator can use `http://localhost:3001`. Tap **Dev** on the home screen, then **Senior** to talk to Kasama (tap the mic, say "Please get me a ride to my doctor tomorrow", tap again). After you say yes, Kasama asks "The Uber is $24.50. Should I book it?" — say yes or tap **Yes**. Nothing is booked until that second yes. Tap **Caretaker** to see the same pending or declined approval.

Speech-to-text and Kasama's voice run on the API through ElevenLabs. Put `ELEVENLABS_API_KEY` in `apps/api/.env` (the key needs Speech to Text **and** Text to Speech). Without it the Senior screen asks you to type and uses iOS speech for replies. The Simulator uses your Mac's microphone.

ChatGPT plans each turn when `MODEL_API_KEY` is in `apps/api/.env` (OpenAI Chat Completions, default `gpt-4o-mini`). Without it the API uses the rules-based turn so the demo line still works.

## Env

Copy `.env.example` into `apps/api/.env` and `apps/mobile/.env` when you add keys.

```text
PORT=3001
EXPO_PUBLIC_API_URL=http://localhost:3001
# Expo Go: http://<mac-lan-ip>:3001
ELEVENLABS_API_KEY=
MODEL_API_KEY=
MODEL_NAME=
BROWSERBASE_API_KEY=
BROWSERBASE_PROJECT_ID=
COMPOSIO_API_KEY=
```

Composio (Gmail for Maria / `senior_maria`): `POST /composio/connect` then `POST /composio/execute` (defaults to `GMAIL_GET_PROFILE`; pass `GMAIL_CREATE_EMAIL_DRAFT` or `GMAIL_SEND_EMAIL` for Jules). Draft results include `data.draft_id`. The key stays in `apps/api/.env`.

## CI

Pull requests and pushes to `main` run `pnpm typecheck` and `pnpm test` in GitHub Actions. Those checks do not need `MODEL_API_KEY`, `ELEVENLABS_API_KEY`, or `COMPOSIO_API_KEY`.

## TEST TEST TESTING THIS IS DAN I SWEAR!