# Business Overview — Kasama

## Business Domain

Kasama is a **voice-first assistive companion for seniors, with caretaker oversight**. It sits in the "aging in place" / assistive-technology domain: helping an older adult (the repo's running persona is "Maria") manage everyday needs — checking appointments, arranging a ride, and reaching a caretaker — through spoken conversation on a mobile phone, while a human caretaker retains approval authority over anything consequential.

## Purpose

The product's core promise, per the repo's own documentation (`README.md`, `ARCHITECTURE.md`, `docs/SAFETY.md`), is **safe delegation**: a senior can ask a conversational assistant to look something up or take an action on their behalf, but the assistant never silently commits the senior (or the caretaker) to anything real without going through an explicit, auditable policy gate. The system is explicitly designed so an AI model — including the ChatGPT-driven conversation harness — **cannot approve its own high-risk actions**; only an authorized actor (the senior or the caretaker, depending on the action) can grant consent, and every decision is recorded.

## Key Functionality

- **Voice-first conversation loop** (senior-facing): the senior speaks; the app transcribes it (ElevenLabs Scribe STT), sends the transcript to the API's `/conversation/turn` endpoint, gets back a reply plus optional tool actions, and speaks the reply back (ElevenLabs TTS). See `component-inventory.md` → `@kasama/mobile` and `api-documentation.md` → `POST /conversation/turn`.
- **Four assistive "tools"**, defined once as the system's formal capability surface (`packages/shared/src/tools.ts`) and dispatched through a single policy-gated pipeline (`apps/api/src/invoke-tool.ts`):
  - `get_appointment` — look up an upcoming appointment (read-only, low risk).
  - `find_ride_options` — search for ride options (read-only; currently a stub returning no options — see `technical debt` in `code-quality-assessment.md`).
  - `book_ride` — book a ride (write/consequential; currently a stub that always reports `not_implemented` rather than fabricating a booking).
  - `notify_caretaker` — send a notification to the caretaker (write/consequential).
- **Policy-gated safety model** (`packages/shared/src/policy.ts`, mirrored in `docs/SAFETY.md`): every tool call is evaluated for actor identity, approval-token presence, and consent before it is allowed to execute — including a `model_cannot_self_approve` rule that stops the ChatGPT harness from approving its own high-risk action requests.
- **Full audit trail**: every tool invocation (allowed, denied, or requiring approval) is appended to an audit log (`GET /audit`) so a caretaker or the team can see what the assistant attempted and why it was allowed or blocked.
- **Session projection**: a per-conversation `SessionView` (`GET /sessions/:sessionId`) gives a caretaker-facing snapshot of what has happened in a given senior's session.
- **Caretaker and dev screens** (`apps/mobile`): a `CaretakerScreen` placeholder for caretaker-facing oversight, and a dev-only `HomeScreen` for local development/testing, alongside the primary `SeniorScreen` voice UI.
- **Email capability (in progress)**: `POST /composio/connect` and `POST /composio/execute` let a session authorize and use Gmail (via the Composio platform SDK), currently scoped to reading the Gmail profile (`GMAIL_GET_PROFILE`). This path is **not yet wired into the policy/audit pipeline** — see `code-quality-assessment.md` and `dependencies.md`.
- **Planned/reserved capability**: live ride-booking via Browserbase is referenced in configuration (`BROWSERBASE_API_KEY`/`BROWSERBASE_PROJECT_ID`) and in the project's own issue tracker language (`#14`/`#7`) but has no implementation yet.

## Primary Actors

- **Senior** (e.g. "Maria", the repo's demo persona) — the primary conversational user; speaks requests, receives spoken replies, and is the actor whose consent gates read-oriented and some write actions.
- **Caretaker** — the human with oversight and approval authority for higher-risk actions (e.g. booking a ride, sending a caretaker notification); the `notify_caretaker` tool and `CaretakerScreen` exist to serve this actor.
- **AI model (ChatGPT harness)** — drives the conversation when configured, but is explicitly constrained by policy from self-approving actions on behalf of either human actor.

## Project Maturity

This is a **hackathon-scale demo/prototype** (per its own documentation): no database (audit log and session store are in-memory, non-durable, cleared on restart), no CI pipeline, and several tool implementations are intentional stubs rather than live integrations. The architectural and safety design (contracts, policy engine, audit trail) is nonetheless deliberate and disciplined — see `architecture.md` and `code-quality-assessment.md` for the concrete evidence.
