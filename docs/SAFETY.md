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
| Share health information | Explicit consent + recipient on allow-list |
| Diagnose | Never |

`book_ride` also counts as `spend_money`.

## Actors

`model` · `senior` · `caretaker` · `doctor`

A token from `actor: "model"` is **not** approval (`model_cannot_self_approve`).

## Audit

Every invoke writes: who asked, what was proposed, approval, whether execute was attempted, outcome. See `GET /audit` (all events, or `?sessionId=`) and `GET /sessions/:sessionId` (session-scoped events plus the current request, pending approval, last booking, and consent).

## Language

Signals are “worth reviewing.” Kasama must never diagnose, change a prescription, or book/charge without a human yes.
