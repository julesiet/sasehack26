# Calendar lookup and Uber ride tools (#7)

Design for [issue #7](https://github.com/mawerb/sasehack26/issues/7): look up Maria’s seeded appointment, return two Uber options including WAV, book only after a human yes, and read back a proven confirmation.

Live Uber (Browserbase or official API) stays [#14](https://github.com/mawerb/sasehack26/issues/14). This issue ships a controlled Uber-shaped provider behind an interface that #14 can implement later.

## Decisions

| Topic | Choice |
|---|---|
| Booking backend | Controlled in-process Uber provider now; same interface for live Uber later |
| Product selection | Voice can pick WAV or UberX; a bare yes defaults to WAV |
| Verification | `book_ride` is the only write; `success: true` only if the provider can re-read the confirmation id |
| Calendar | Seeded `get_appointment` only. No Composio calendar in this issue |
| UI | No ride cards (#8). No designed UI work |

## Architecture

Kasama tools still go through `invokeTool` → policy → audit → session. Only the ride **execute** step changes.

```text
get_appointment     → seeded Maria calendar (unchanged)
find_ride_options   → UberProvider.findOptions
book_ride           → UberProvider.book (re-reads its own write)
notify_caretaker    → unchanged stub
```

`UberProvider` lives in `apps/api` (`apps/api/src/uber-provider.ts`). Zod contracts stay in `packages/shared`. Mobile does not call the provider.

This issue always uses the controlled implementation. No `UBER_PROVIDER` env switch.

## Provider

```ts
interface UberProvider {
  findOptions(input: FindRideOptionsInput): FindRideOptionsResult;
  book(optionId: string): BookRideResult;
}
```

Process-local maps (cleared on API restart, same as session and audit):

- **quotes** keyed by `optionId`
- **bookings** keyed by `confirmationId`

### Quotes

Demo option ids stay `uberx_1` and `uber_wav_1` so existing checkpoint helpers (`DEMO_UBER_WAV_OPTION_ID`) keep working.

The provider starts with those two quotes using Maria’s seed pickup, destination, and `computeArrivalTarget` (10:15 for a 10:30 appointment). A direct approved `book_ride` of `uber_wav_1` therefore works without a prior search.

`findOptions` always returns exactly two products:

| optionId | product | estimate | accessible |
|---|---|---|---|
| `uberx_1` | UberX | $18.00 | false |
| `uber_wav_1` | WAV | $24.50 | true |

It overwrites the stored quotes with the request’s `pickup`, `destination`, and `arriveBy`. Summary names both options as Uber.

### Book and verify

`book(optionId)`:

1. If there is no quote for `optionId`, return `success: false`, no `confirmationId`, no `booking`.
2. Write a booking with a new confirmation id.
3. Immediately look up that id in the bookings map.
4. If the lookup misses, return `success: false` and do not claim a booking (do not leave a readable booked record).
5. If the lookup hits, return `success: true`, `confirmationId`, `summary`, and `booking: { provider: "uber", optionId, status: "booked" }`.

Confirmation id format: `UBER-{PRODUCT}-{NNNN}` where `PRODUCT` is `WAV` or `UBERX` and `NNNN` is a **single process-local counter** (not per product), padded to four digits, starting at `0001`. The first booking in a process is `UBER-WAV-0001` or `UBER-UBERX-0001` depending on product. The second is `…-0002` even if the product differs.

`createControlledUberProvider(options?)` is the factory. Tests pass `{ failNextVerify: true }` to force the post-write lookup to miss once. There is no production way to skip verification.

The controlled provider never returns `status: "not_implemented"`. That enum value stays on `sessionBookingSchema` / `bookRideResultSchema` for compatibility and is unused on the success path.

`not_implemented` is not a valid successful booking.

## Tool invoke and session

`executeStub` in `apps/api/src/invoke-tool.ts` calls the provider for `find_ride_options` and `book_ride`. `get_appointment` stays on `getMariaAppointment` / `computeArrivalTarget`.

Policy is unchanged:

- `find_ride_options` is automatic
- `book_ride` requires a human `approvalToken` and `actor !== "model"`

When policy allows execute but the provider fails verification, HTTP status stays **200**. The body has `success: false`. That is a failed booking, not a policy denial (403).

`sessionStore` sets `lastBooking` only when the result is `success: true` and `booking.status === "booked"`. A failed book leaves `lastBooking` as it was (usually `null`).

## Conversation

Calendar path is unchanged: “ride to the doctor” / “what time is my appointment” uses `get_appointment` so Maria does not restate details.

Spoken times use `computeArrivalTarget` (15 minutes before the appointment). For the demo that is **around 10:15** for the 10:30 checkup. Do not keep the current 30-minute-early pickup sentence.

### Product choice

Add optional `product` to `activeRequestSchema`: `"UberX" | "WAV"`.

After `lastRideOptions` exist (or on the original request), voice selects a product:

| Spoken | Product | Checkpoint |
|---|---|---|
| accessible, WAV, wheelchair | WAV | $24.50 WAV |
| cheaper, UberX, regular | UberX | $18.00 UberX |
| bare yes (no product words) | WAV | $24.50 WAV |

A product phrase on the ride proposal (“Should I set that up?”) accepts the plan and opens that product’s checkpoint. The same words in the original request (“get me the accessible Uber to the doctor”) store `activeRequest.product` and use it when the checkpoint opens.

The checkpoint itself stays yes / no for the already-chosen `optionId`. It does not change product.

Rules-based turns and the ChatGPT harness share one picker: `activeRequest.product` if set, otherwise WAV / accessible from `lastRideOptions`, otherwise `DEMO_UBER_WAV_OPTION_ID`.

No ride-option cards.

### Confirmation read-back

After a human yes, `book_ride` runs as `senior` with a token.

On proven success, Kasama speaks one simple line: product, price, confirmation id.

- WAV: `I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.`
- UberX: `I booked the UberX for $18.00. Your confirmation is UBER-UBERX-0001.`

Update `approvedBookingReply` in `packages/shared/src/approval.ts` to take `{ estimate, product, confirmationId }` and produce that sentence. Never say “booked” without a `confirmationId`.

On a failed re-read or missing quote:

`I couldn't confirm that Uber booking. Nothing was charged. We can try again.`

`conversation.failure` is `{ kind: "retry", tool: "book_ride", summary }` when execute was attempted and `success` is false.

## Errors

| Case | Result |
|---|---|
| Model `book_ride` | 403, `confirmation_required` / `model_cannot_self_approve`, no execute |
| Human decline | `declined_by_human`, no execute, no `lastBooking` |
| Unknown `optionId` / no quote | 200, `success: false`, no `lastBooking`, Kasama does not say booked |
| Write that cannot be re-read | same as above |
| API process restart | quotes and bookings gone, same as session / audit |

## Tests

Provider (`apps/api/src/uber-provider.test.ts`):

- `findOptions` returns UberX and accessible WAV at the demo prices
- booking an unknown `optionId` fails
- booking `uber_wav_1` returns `UBER-WAV-0001` and a later lookup of that id succeeds
- a forced re-read miss returns `success: false` and does not leave a booked record

`invokeTool` / `app.test.ts`:

- `book_ride` without a token is still 403
- approved `book_ride` of `uber_wav_1` is 200, `success: true`, `status: "booked"`, confirmation id present
- approved `book_ride` of `unknown_option` is 200, `success: false`

Conversation:

- “Choose the accessible one” after the ride proposal opens the WAV / $24.50 checkpoint
- “the cheaper one” opens the UberX / $18.00 checkpoint
- a second human yes on WAV speaks the wheelchair confirmation line including the id
- a failed book does not say “booked” and sets `failure.kind` to `retry`

Existing two-yes WAV demo tests stay green (bare yes still defaults to WAV). Session fixtures that expect `not_implemented` after a successful book change to `booked`.

## Docs

Update only the canonical files:

- `ARCHITECTURE.md` — Uber is a controlled provider; `book_ride` returns `booked` + confirmation id; live Uber remains #14; calendar stays seeded
- `AGENTS.md` — same facts (tools are no longer “Uber is a stub” on the book path)

Do not change `SAFETY.md` (policy table is unchanged). Do not add a second architecture doc.

## Out of scope

- Live Uber / Browserbase / Stagehand / official Uber API (#14)
- Composio calendar
- Ride-option cards (#8)
- Caretaker dashboard, care-signal UI, notify UI
- Designed senior UI
- Closing the GitHub issue
