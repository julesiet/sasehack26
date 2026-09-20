# Honor Maria's communication preferences (#31)

Design for [issue #31](https://github.com/mawerb/sasehack26/issues/31): Kasama's voice and spoken copy follow `MARIA_PROFILE.communicationPreferences` instead of ignoring those flags.

No new screens. No Dev toggle. Flags are data-model booleans on the seed profile (and tests). Maria's demo seed stays all `true`.

## Decisions

| Topic | Choice |
|---|---|
| Speed source | Shared helpers from `speaksSlowly`. ElevenLabs `0.88` when slow, else `1.0`. Device `expo-speech` `0.92` when slow, else `1.0` |
| Confirmation repeat | Spoken audio only. Chat bubble, confirmation card, `reply`, and `pendingApproval.prompt` stay the current single sentence |
| Repeat trigger | `repeatsConfirmations` and the pending tool is `book_ride` (the $24.50 Uber checkpoint) |
| Simple language | Wire `prefersSimpleLanguage` into the harness system prompt. Do not rewrite rules-based copy. Add jargon-free tests |
| UI | No settings toggle. Flip flags in seed or tests only |
| Speak route | `POST /speech/speak` still takes `{ text }`. The iOS caller passes already-adjusted spoken text |

## Architecture

```text
MARIA_PROFILE.communicationPreferences
        ↓
packages/shared helpers (speed, device rate, spoken TTS text, simple-language line)
        ↓
  ┌─────┴──────┐
  API TTS      iOS expo-speech fallback
  (0.88 slow)  (0.92 slow)
```

Conversation and approval helpers are unchanged for on-screen text. Doubling happens only in the speak path.

## Helpers

New module `packages/shared/src/communication.ts`, re-exported from `packages/shared`.

| Helper | Behavior |
|---|---|
| `elevenLabsSpeechSpeed(prefs)` | `speaksSlowly` → `0.88`, else `1.0` |
| `deviceSpeechRate(prefs)` | `speaksSlowly` → `0.92`, else `1.0` |
| `spokenTextForTts(text, prefs, { repeatConfirmation })` | If `repeatsConfirmations` and `repeatConfirmation`, return the full `text` twice joined by a space; otherwise return `text` |
| `simpleLanguageInstruction(prefs)` | If `prefersSimpleLanguage`, `"Speak in short, simple sentences she can hear."`; otherwise omit |

`createElevenLabsSpeaker` reads speed from `elevenLabsSpeechSpeed`. Default prefs are Maria's. Tests may pass other prefs so `speaksSlowly: false` yields `1.0`.

`useKasamaConversation` uses `deviceSpeechRate` for `expo-speech` and `spokenTextForTts` when calling ElevenLabs or the device fallback. `kasamaText` / UI still show the original `reply`. Repeat when `pending?.tool === "book_ride"`.

`bookingApprovalPrompt()` stays `The Uber is $24.50. Should I book it?`.

## Simple language

`apps/api/src/harness.ts` includes `simpleLanguageInstruction(MARIA_PROFILE.communicationPreferences)` in the system prompt. Safety lines ("Never diagnose. Never change medication.") stay always-on.

Rules-based strings are not rewritten. Tests assert a ride checkpoint reply has no medical jargon and still includes `$24.50`.

## Errors

TTS/STT failures unchanged (`501` not configured → device fallback). Doubling spoken text must not change `pendingApproval.prompt` if speak fails.

## Testing

- Shared helper tests: Maria seed → `0.88` / `0.92`; all flags false → `1.0` / `1.0` and no TTS doubling; booking checkpoint + `repeatsConfirmations` → sentence spoken twice
- `speech.test.ts`: ElevenLabs JSON `voice_settings.speed` is `0.88` for Maria and `1.0` when `speaksSlowly` is false
- Conversation / playground: still the single `$24.50` prompt; checkpoint reply has no diagnosis/prescription jargon
- Harness: system prompt includes the simple-language line for Maria
- After harness/copy touch: `pnpm playground` still stops at the checkpoint with `lastBooking: null`

## Out of scope

Designed conversation chrome, ride cards, new voices, speech debug screen (#17), in-app preference toggle, live Uber (#14).
