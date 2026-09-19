# Architecture

Kasama is one React Native iOS app (senior + caretaker modes) talking to one TypeScript agent API.

```text
Kasama (Expo, iOS)
  Senior mode: voice, Uber cards, spoken + tap confirmation
  Caretaker mode: activity, consent, care signals
        ↓
Kasama API (Hono)
  Intent / planning (later) · policy · tools · session · audit
        ↓
Tools
  get_appointment · find_ride_options (Uber) · book_ride (Uber) · notify_caretaker
```

Core loop:

```text
Senior speaks on iPhone → Kasama understands intent → Kasama gathers care context
→ Kasama proposes an action → Senior/caretaker approves on device → Kasama executes and verifies
```

## Packages

| Path | Name | Role |
|---|---|---|
| `apps/mobile` | `@kasama/mobile` | Expo iOS client. Placeholder Home / Senior / Caretaker. Hidden Dev toggle. |
| `apps/api` | `@kasama/api` | Hono server. Health, tool invoke, audit. |
| `packages/shared` | `@kasama/shared` | Zod contracts, `POLICY_TABLE`, audit schema. Imported by API and mobile. |

Do not add `apps/web` or an Android app. Do not move contracts out of `packages/shared`.

## Mobile

- Expo SDK in `apps/mobile`, iOS Simulator via `pnpm ios`
- `EXPO_PUBLIC_API_URL` defaults to `http://localhost:3001` (Simulator can use localhost)
- StyleSheet only until designs land
- Screens today: `App.tsx` switches `HomeScreen` / `SeniorScreen` / `CaretakerScreen`
- Designed UI replaces those screens; it does not replace the API

## API

Entry: `apps/api/src/index.ts` listens on `PORT` (default 3001). App routes live in `apps/api/src/app.ts`.

`POST /tools/:name` body:

```json
{
  "input": { },
  "actor": "model" | "senior" | "caretaker" | "doctor",
  "approvalToken": "optional-human-token",
  "sessionId": "optional",
  "consentGranted": false,
  "recipient": "optional",
  "allowedRecipients": []
}
```

Flow: parse name → Zod input → `evaluateToolCall` → append audit → stub execute (or 403).

`GET /audit` returns `{ events }` from the process-local log (`apps/api/src/audit-log.ts`). Not durable.

## Shared contracts

- `packages/shared/src/tools.ts` — tool names, inputs, results (Uber products: `UberX`, `WAV`)
- `packages/shared/src/policy.ts` — `POLICY_TABLE`, `evaluateAction`, `evaluateToolCall`
- `packages/shared/src/audit.ts` — event shape + `createAuditLog()`
- `packages/shared/src/invoke.ts` — HTTP request schema
- `packages/shared/src/index.ts` — re-exports

If you add a tool, add it to `tools.ts`, map it in `TOOL_ACTIONS`, handle it in `apps/api/src/invoke-tool.ts`, add tests, and update this file.

## Uber

Booking is through Uber. `find_ride_options` / `book_ride` are Uber-shaped. Live Uber (API or Browserbase) is issue `#14` / `#7`. Until then stubs return structured `{ success, summary, ... }` and still go through policy.

Fallback if live Uber is blocked: a controlled Uber-shaped environment — still presented as Uber, not a generic cab.

## What is not built yet

Agent harness / playground (`#5`, `#13`), Maria seed (`#2`), live calendar + Uber (`#7`, `#14`), designed UI (`#4`, `#6`, `#8`, `#9`), care-signal UI (`#10`), notify UI (`#11`), session HTTP (`#18`).

## Keeping architecture context shared

When this diagram, a package, a route, or a tool changes, update **this file** and [AGENTS.md](AGENTS.md). Do not start a second architecture doc.
