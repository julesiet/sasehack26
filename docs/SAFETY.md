# Safety

Human-readable policy. The encoded table is `packages/shared/src/policy.ts`. If they disagree, **the code is wrong or this file is stale — fix both**.

## Table

| Action | Default |
|---|---|
| Read calendar | Automatic |
| Search Uber rides | Automatic |
| Draft caretaker message | Automatic, preview only |
| Send message | Require confirmation |
| Book Uber | Require confirmation |
| Spend money | Require confirmation |
| Change medication or medical plan | Caretaker or doctor + approval token |
| Save a medication reminder to Tasks | Require confirmation (not a prescription change) |
| Save local hospital appointment details | Require confirmation (not live EHR) |
| Share health information | Explicit consent + recipient on allow-list |
| Diagnose | Never |

`book_ride` also counts as `spend_money`. `notify_caretaker` is `draft_caretaker_message` until a human token is present, then `send_message`. `save_medication_reminder` adds a Tasks item after a human yes; it is never `change_medication`. A stub health-sync miss is recoverable (retry or save locally). `save_hospital_visit` stores local appointment details after a human yes.

## Actors

`model` · `senior` · `caretaker` · `doctor`

A token from `actor: "model"` is **not** approval (`model_cannot_self_approve`).

## Audit

Every invoke writes: who asked, what was proposed, approval, whether execute was attempted, outcome. A human "No" writes `declined_by_human` and never executes. See `GET /audit` (all events, or `?sessionId=`), `GET /sessions/:sessionId` (pending approval, last approval, last booking, consent), and `POST /approvals` for the iPhone Yes / No.

`POST /playground` and `pnpm playground` use the same policy. They may accept a conversational ride plan so you can see the $24.50 prompt; they never auto-approve book, send, or spend. Coding agents should run the playground after policy or approval changes to confirm book / send / spend still stop at a human checkpoint.

## Language

Signals are “worth reviewing.” Kasama must never diagnose, change a prescription, or book/charge without a human yes.

`POST /composio/execute` may create a Gmail draft (`GMAIL_CREATE_EMAIL_DRAFT`) or send (`GMAIL_SEND_EMAIL`) when the HTTP caller asks. Default remains `GMAIL_GET_PROFILE`. A `notify_caretaker` preview never calls Gmail; only a human-approved send invokes `GMAIL_SEND_EMAIL`, with a mock fallback when Composio is unconfigured or needs authorization. A model actor cannot self-approve a send.
