# Calendar and Uber Ride Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stub Uber execute with a controlled in-process provider so Kasama can look up Maria’s seeded appointment, return UberX + WAV, book only after a human yes, and read back a proven confirmation id.

**Architecture:** Zod contracts stay in `packages/shared`. `apps/api/src/uber-provider.ts` owns quotes and bookings. `invokeTool` is still the only execute path (policy + audit unchanged). Conversation picks WAV or UberX by voice, then `book_ride` succeeds only when the provider can re-read the confirmation it just wrote. Live Uber remains issue #14.

**Tech Stack:** TypeScript, Zod, Vitest, Hono, `@kasama/shared`, existing conversation / approval / session store.

**Spec:** `docs/superpowers/specs/2026-09-19-calendar-uber-tools-design.md`

## Global Constraints

- Call the product AI **Kasama**, never “the AI”, “the assistant”, or “the agent” in user-facing copy or docs.
- Ride booking is **Uber only** — never a generic cab.
- Never book or charge without a human `approvalToken` and `actor !== "model"`.
- Calendar stays seeded `get_appointment`. No Composio calendar. No Browserbase. No ride cards (#8). No designed UI.
- Demo option ids stay `uberx_1` and `uber_wav_1`. Prices stay `$18.00` (UberX) and `$24.50` (WAV).
- Confirmation ids are `UBER-{WAV|UBERX}-{NNNN}` with one process-local counter starting at `0001`.
- This issue always uses the controlled provider. No `UBER_PROVIDER` env switch.
- Policy-allowed but unverified books are HTTP **200** with `success: false`. `lastBooking` is set only when `success: true` and `status === "booked"`.
- iOS-only Expo Go app. Do not add web or Android.
- This repo only commits when the human asks. Include the commit step, but skip it during execution unless they asked.
- Do not close GitHub issue #7.

## File map

| File | Responsibility |
|---|---|
| Create `apps/api/src/uber-provider.ts` | `UberProvider` interface, controlled maps, factory, singleton, reset |
| Create `apps/api/src/uber-provider.test.ts` | Provider unit tests |
| Modify `packages/shared/src/conversation.ts` | Optional `activeRequest.product` |
| Modify `packages/shared/src/approval.ts` | `approvedBookingReply({ estimate, product, confirmationId })`, `failedBookingReply()` |
| Modify `packages/shared/src/approval.test.ts` | New reply tests |
| Modify `packages/shared/src/conversation.test.ts` | Schema accepts `product` |
| Modify `apps/api/src/invoke-tool.ts` | Ride tools call the provider |
| Modify `apps/api/src/session-store.ts` | Project `lastBooking` only for proven books |
| Modify `apps/api/src/approval.ts` | Speak confirmation or failure; surface `failure` |
| Modify `apps/api/src/conversation.ts` | Product words, 10:15 arrival, shared picker |
| Modify `apps/api/src/conversation.test.ts` | Accessible / cheaper / confirmation / failed book |
| Modify `apps/api/src/app.test.ts` | `booked` + unknown option + reset provider |
| Modify `ARCHITECTURE.md`, `AGENTS.md` | Controlled Uber now; live Uber is #14 |

Do not change `packages/shared/src/policy.ts` or `docs/SAFETY.md`. Do not change `apps/mobile/src/lib/mvp-confirmation.ts` (designed card; out of scope).

---

### Task 1: Shared product field and spoken booking replies

**Files:**
- Modify: `packages/shared/src/conversation.ts`
- Modify: `packages/shared/src/approval.ts`
- Modify: `packages/shared/src/approval.test.ts`
- Modify: `packages/shared/src/conversation.test.ts`
- Modify: `apps/api/src/approval.ts` (keep typecheck green)

**Interfaces:**
- Consumes: existing `uberProductSchema` (`"UberX" | "WAV"`), `DEMO_UBER_WAV_ESTIMATE`
- Produces: `activeRequest.product?: "UberX" | "WAV"`; `approvedBookingReply({ estimate?: string; product?: "UberX" | "WAV"; confirmationId: string }): string`; `failedBookingReply(): string`

- [ ] **Step 1: Write the failing shared tests**

Add to `packages/shared/src/approval.test.ts`:

```ts
import {
  approvedBookingReply,
  failedBookingReply,
  bookingApprovalPrompt,
  describePendingApproval,
  DEMO_UBER_WAV_ESTIMATE,
} from "./approval";

it("reads a WAV booking back with the confirmation id", () => {
  expect(
    approvedBookingReply({
      estimate: DEMO_UBER_WAV_ESTIMATE,
      product: "WAV",
      confirmationId: "UBER-WAV-0001",
    }),
  ).toBe("I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.");
});

it("reads an UberX booking back with the confirmation id", () => {
  expect(
    approvedBookingReply({
      estimate: "$18.00",
      product: "UberX",
      confirmationId: "UBER-UBERX-0001",
    }),
  ).toBe("I booked the UberX for $18.00. Your confirmation is UBER-UBERX-0001.");
});

it("does not claim a booking when verification failed", () => {
  expect(failedBookingReply()).toBe(
    "I couldn't confirm that Uber booking. Nothing was charged. We can try again.",
  );
});
```

Add to `packages/shared/src/conversation.test.ts` inside the existing contract describe:

```ts
it("accepts a preferred Uber product on the active request", () => {
  const parsed = conversationTurnResponseSchema.parse({
    sessionId: "default",
    reply: "Should I set that up?",
    kind: "proposal",
    activeRequest: { intent: "ride", status: "proposed", product: "WAV" },
    clarificationsAsked: 0,
  });
  expect(parsed.activeRequest?.product).toBe("WAV");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @kasama/shared test`

Expected: FAIL — `approvedBookingReply` / `failedBookingReply` missing or still the old one-string signature; `product` not on the schema.

- [ ] **Step 3: Implement the contract**

In `packages/shared/src/conversation.ts`, import `uberProductSchema` from `./tools` and add it to `activeRequestSchema`:

```ts
export const activeRequestSchema = z.object({
  intent: conversationIntentSchema,
  destination: z.string().optional(),
  date: z.string().optional(),
  appointmentId: z.string().optional(),
  product: uberProductSchema.optional(),
  status: z.enum(["gathering", "proposed", "accepted"]),
});
```

Replace `approvedBookingReply` in `packages/shared/src/approval.ts` and add `failedBookingReply`:

```ts
export function approvedBookingReply(input: {
  estimate?: string;
  product?: "UberX" | "WAV";
  confirmationId: string;
}): string {
  const estimate = input.estimate ?? DEMO_UBER_WAV_ESTIMATE;
  const spoken = input.product === "UberX" ? "UberX" : "wheelchair Uber";
  return `I booked the ${spoken} for ${estimate}. Your confirmation is ${input.confirmationId}.`;
}

export function failedBookingReply(): string {
  return "I couldn't confirm that Uber booking. Nothing was charged. We can try again.";
}
```

Update `apps/api/src/approval.ts` so it still typechecks. After `invokeTool`, read the session and speak the new replies. Add `failure` on `ResolvedApproval` now (needed in Task 4; keep it `null` except when a book execute produced no confirmation):

```ts
import {
  approvedBookingReply,
  approvedNotifyReply,
  declinedBookingReply,
  declinedNotifyReply,
  failedBookingReply,
  resolveSessionId,
  type ActiveRequest,
  type Actor,
  type ApprovalChoice,
  type ConversationFailure,
  type ConversationPlan,
} from "@kasama/shared";

export type ResolvedApproval = {
  reply: string;
  activeRequest: ActiveRequest | null;
  plan: ConversationPlan;
  failure: ConversationFailure | null;
};

// inside resolvePendingApproval, after a successful-policy invoke:
const view = sessionStore.get(sessionId);
if (pending.tool === "notify_caretaker") {
  return {
    reply: approvedNotifyReply(),
    activeRequest: view.conversation.activeRequest,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: null,
  };
}

const confirmationId = view.lastBooking?.confirmationId;
const option = view.lastRideOptions.find((item) => {
  const input = pending.input;
  return (
    input &&
    typeof input === "object" &&
    "optionId" in input &&
    item.optionId === String((input as { optionId: unknown }).optionId)
  );
});
if (!confirmationId) {
  return {
    reply: failedBookingReply(),
    activeRequest: view.conversation.activeRequest,
    plan: planFromAuditEvents(auditLog.list().slice(before)),
    failure: {
      kind: "retry",
      tool: "book_ride",
      summary: "Uber booking could not be confirmed.",
    },
  };
}
return {
  reply: approvedBookingReply({
    estimate: pending.estimate ?? option?.estimate,
    product: option?.product,
    confirmationId,
  }),
  activeRequest: view.conversation.activeRequest,
  plan: planFromAuditEvents(auditLog.list().slice(before)),
  failure: null,
};
```

Thread `failure: resolved.failure` into `sessionStore.applyConversationTurn` in `decideApproval`. Decline / empty-pending paths return `failure: null`.

- [ ] **Step 4: Run the shared tests and API approval tests**

Run:

```sh
pnpm --filter @kasama/shared test
pnpm --filter @kasama/api test -- src/approval.ts src/conversation.test.ts
```

Expected: PASS for the new shared tests. Existing conversation tests still pass (they do not assert the old “Okay. I booked that Uber” sentence). `lastBooking.confirmationId` is still the stub id until Task 3.

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add packages/shared/src/conversation.ts packages/shared/src/approval.ts packages/shared/src/approval.test.ts packages/shared/src/conversation.test.ts apps/api/src/approval.ts
git commit -m "$(cat <<'EOF'
Add spoken Uber confirmation replies and optional ride product on the active request.

EOF
)"
```

---

### Task 2: Controlled Uber provider

**Files:**
- Create: `apps/api/src/uber-provider.ts`
- Create: `apps/api/src/uber-provider.test.ts`

**Interfaces:**
- Consumes: `FindRideOptionsInput`, `FindRideOptionsResult`, `BookRideResult`, `getMariaAppointment()`, `computeArrivalTarget()`, demo option ids
- Produces: `UberProvider { findOptions(input); book(optionId) }`; `createControlledUberProvider(options?: { failNextVerify?: boolean })`; `getUberProvider()`; `resetControlledUberProvider(options?)`

- [ ] **Step 1: Write the failing provider tests**

Create `apps/api/src/uber-provider.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createControlledUberProvider } from "./uber-provider";

describe("createControlledUberProvider", () => {
  it("returns UberX and accessible WAV at the demo prices", () => {
    const uber = createControlledUberProvider();
    const result = uber.findOptions({
      pickup: "412 Willow Lane, Springfield",
      destination: "Springfield Family Medicine, 88 Oak St, Springfield",
      arriveBy: "2026-09-20T10:15:00",
    });
    expect(result.success).toBe(true);
    expect(result.options).toEqual([
      expect.objectContaining({
        optionId: "uberx_1",
        provider: "uber",
        product: "UberX",
        estimate: "$18.00",
        accessible: false,
      }),
      expect.objectContaining({
        optionId: "uber_wav_1",
        provider: "uber",
        product: "WAV",
        estimate: "$24.50",
        accessible: true,
      }),
    ]);
    expect(result.summary).toContain("Uber");
  });

  it("fails booking when the option was never quoted", () => {
    const uber = createControlledUberProvider();
    const result = uber.book("unknown_option");
    expect(result.success).toBe(false);
    expect(result.confirmationId).toBeUndefined();
    expect(result.booking).toBeUndefined();
  });

  it("books WAV with a re-readable confirmation id", () => {
    const uber = createControlledUberProvider();
    const result = uber.book("uber_wav_1");
    expect(result.success).toBe(true);
    expect(result.confirmationId).toBe("UBER-WAV-0001");
    expect(result.booking).toEqual({
      provider: "uber",
      optionId: "uber_wav_1",
      status: "booked",
    });
    const second = uber.book("uberx_1");
    expect(second.confirmationId).toBe("UBER-UBERX-0002");
  });

  it("fails loudly when the post-write lookup misses", () => {
    const uber = createControlledUberProvider({ failNextVerify: true });
    const result = uber.book("uber_wav_1");
    expect(result.success).toBe(false);
    expect(result.confirmationId).toBeUndefined();
    expect(result.booking).toBeUndefined();
    const retry = uber.book("uber_wav_1");
    expect(retry.success).toBe(true);
    expect(retry.confirmationId).toBe("UBER-WAV-0002");
  });
});
```

The last test assumes the failed attempt still increments the counter (a write was attempted). If you delete the record before incrementing, adjust the expected retry id to `UBER-WAV-0001` and keep the test asserting `success: false` then a later success. Prefer increment-then-delete so ids never reuse.

- [ ] **Step 2: Run the test file to verify it fails**

Run: `pnpm --filter @kasama/api test -- src/uber-provider.test.ts`

Expected: FAIL — `Cannot find module './uber-provider'`.

- [ ] **Step 3: Implement the provider**

Create `apps/api/src/uber-provider.ts`:

```ts
import {
  bookRideResultSchema,
  computeArrivalTarget,
  findRideOptionsInputSchema,
  findRideOptionsResultSchema,
  getMariaAppointment,
  type BookRideResult,
  type FindRideOptionsInput,
  type FindRideOptionsResult,
} from "@kasama/shared";

export type UberProvider = {
  findOptions: (input: FindRideOptionsInput) => FindRideOptionsResult;
  book: (optionId: string) => BookRideResult;
};

export type ControlledUberProviderOptions = {
  failNextVerify?: boolean;
};

const DEMO_OPTIONS = [
  {
    optionId: "uberx_1",
    product: "UberX" as const,
    estimate: "$18.00",
    etaMinutes: 8,
    accessible: false,
  },
  {
    optionId: "uber_wav_1",
    product: "WAV" as const,
    estimate: "$24.50",
    etaMinutes: 12,
    accessible: true,
  },
] as const;

type Quote = {
  optionId: string;
  product: "UberX" | "WAV";
  estimate: string;
  accessible: boolean;
  pickup: string;
  destination: string;
  arriveBy: string;
};

type StoredBooking = {
  confirmationId: string;
  optionId: string;
};

export function createControlledUberProvider(
  options: ControlledUberProviderOptions = {},
): UberProvider {
  const quotes = new Map<string, Quote>();
  const bookings = new Map<string, StoredBooking>();
  let nextSerial = 1;
  let failNextVerify = Boolean(options.failNextVerify);

  const appointment = getMariaAppointment();
  const arriveBy = computeArrivalTarget(appointment);
  for (const option of DEMO_OPTIONS) {
    quotes.set(option.optionId, {
      optionId: option.optionId,
      product: option.product,
      estimate: option.estimate,
      accessible: option.accessible,
      pickup: appointment.pickup,
      destination: appointment.destination,
      arriveBy,
    });
  }

  return {
    findOptions(input) {
      const parsed = findRideOptionsInputSchema.parse(input);
      for (const option of DEMO_OPTIONS) {
        quotes.set(option.optionId, {
          optionId: option.optionId,
          product: option.product,
          estimate: option.estimate,
          accessible: option.accessible,
          pickup: parsed.pickup,
          destination: parsed.destination,
          arriveBy: parsed.arriveBy,
        });
      }
      return findRideOptionsResultSchema.parse({
        success: true,
        summary: `Two Uber options from ${parsed.pickup} to ${parsed.destination}: UberX about $18.00, WAV about $24.50.`,
        options: DEMO_OPTIONS.map((option) => ({
          optionId: option.optionId,
          provider: "uber" as const,
          product: option.product,
          estimate: option.estimate,
          etaMinutes: option.etaMinutes,
          accessible: option.accessible,
        })),
      });
    },
    book(optionId) {
      const quote = quotes.get(optionId);
      if (!quote) {
        return bookRideResultSchema.parse({
          success: false,
          summary: "That Uber option is no longer available. Nothing was booked.",
        });
      }
      const productToken = quote.product === "WAV" ? "WAV" : "UBERX";
      const confirmationId = `UBER-${productToken}-${String(nextSerial).padStart(4, "0")}`;
      nextSerial += 1;
      const record = { confirmationId, optionId };
      bookings.set(confirmationId, record);
      if (failNextVerify) {
        failNextVerify = false;
        bookings.delete(confirmationId);
      }
      const proven = bookings.get(confirmationId);
      if (!proven) {
        return bookRideResultSchema.parse({
          success: false,
          summary: "I couldn't confirm that Uber booking. Nothing was charged.",
        });
      }
      return bookRideResultSchema.parse({
        success: true,
        confirmationId,
        summary: `Uber ${quote.product} booked for ${quote.estimate}. Confirmation ${confirmationId}.`,
        booking: { provider: "uber", optionId, status: "booked" },
      });
    },
  };
}

let singleton = createControlledUberProvider();

export function getUberProvider(): UberProvider {
  return singleton;
}

export function resetControlledUberProvider(
  options: ControlledUberProviderOptions = {},
): UberProvider {
  singleton = createControlledUberProvider(options);
  return singleton;
}
```

- [ ] **Step 4: Run the provider tests**

Run: `pnpm --filter @kasama/api test -- src/uber-provider.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/api/src/uber-provider.ts apps/api/src/uber-provider.test.ts
git commit -m "$(cat <<'EOF'
Add a controlled Uber provider that only reports booked after a re-readable confirmation.

EOF
)"
```

---

### Task 3: Wire invokeTool and lastBooking

**Files:**
- Modify: `apps/api/src/invoke-tool.ts`
- Modify: `apps/api/src/session-store.ts`
- Modify: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `getUberProvider()`, `resetControlledUberProvider()`
- Produces: `find_ride_options` / `book_ride` results from the provider; `lastBooking` only when `success && booking.status === "booked"`

- [ ] **Step 1: Write the failing HTTP tests**

In `apps/api/src/app.test.ts`, import and reset the provider in `beforeEach`:

```ts
import { resetControlledUberProvider } from "./uber-provider";

beforeEach(() => {
  auditLog.clear();
  sessionStore.clear();
  resetControlledUberProvider();
  process.env.MODEL_API_KEY = "";
});
```

Extend the existing `"executes book_ride only when a human approval token is present"` test:

```ts
expect(body.success).toBe(true);
expect(body.booking?.status).toBe("booked");
expect(body.confirmationId).toBe("UBER-UBERX-0001");
```

Add:

```ts
it("does not project lastBooking when book_ride cannot be verified", async () => {
  const res = await app.request("/tools/book_ride", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: { optionId: "unknown_option" },
      actor: "senior",
      approvalToken: "tok_yes",
      sessionId: "bad-book",
    }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.success).toBe(false);
  expect(body.confirmationId).toBeUndefined();
  expect(sessionStore.get("bad-book").lastBooking).toBeNull();
});
```

In `"projects appointment, ride, timestamp, and consent after a booking-style flow"` add:

```ts
expect(body.lastBooking?.status).toBe("booked");
expect(body.lastBooking?.confirmationId).toMatch(/^UBER-UBERX-\d{4}$/);
```

- [ ] **Step 2: Run the new assertions to verify they fail**

Run: `pnpm --filter @kasama/api test -- src/app.test.ts`

Expected: FAIL — stub still returns `not_implemented` and `stub_uber_uberx_1`; unknown option currently succeeds.

- [ ] **Step 3: Wire the provider and gate lastBooking**

In `apps/api/src/invoke-tool.ts`, import `getUberProvider` and replace the `find_ride_options` and `book_ride` branches:

```ts
case "find_ride_options": {
  return getUberProvider().findOptions(findRideOptionsInputSchema.parse(input));
}
case "book_ride": {
  const { optionId } = bookRideInputSchema.parse(input);
  return getUberProvider().book(optionId);
}
```

In `apps/api/src/session-store.ts` `applyToolEvent`, only set `lastBooking` on a proven book:

```ts
if (tool === "book_ride" && result) {
  const booked = bookRideResultSchema.parse(result);
  if (booked.success && booked.booking?.status === "booked") {
    const { optionId } = bookRideInputSchema.parse(input);
    state.lastBooking = {
      provider: "uber",
      optionId,
      status: "booked",
      confirmationId: booked.confirmationId,
      summary: booked.summary,
      timestamp: event.timestamp,
      consentGranted: consentGranted ?? true,
    };
    state.consentGranted = true;
    state.conversation.activeRequest = null;
  }
}
```

- [ ] **Step 4: Run API tests**

Run: `pnpm --filter @kasama/api test`

Expected: PASS. Conversation two-yes path now stores `lastBooking.status === "booked"` with `UBER-WAV-0001` after `resetControlledUberProvider()` in conversation tests (add that reset in this step if conversation tests fail on leftover serials — they currently do not assert the id).

Add `resetControlledUberProvider()` to `apps/api/src/conversation.test.ts` `beforeEach` in this task so later tests get `UBER-WAV-0001`.

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/api/src/invoke-tool.ts apps/api/src/session-store.ts apps/api/src/app.test.ts apps/api/src/conversation.test.ts
git commit -m "$(cat <<'EOF'
Book Uber through the controlled provider and project lastBooking only when confirmed.

EOF
)"
```

---

### Task 4: Conversation product choice, 10:15 arrival, confirmation read-back

**Files:**
- Modify: `apps/api/src/conversation.ts`
- Modify: `apps/api/src/conversation.test.ts`
- Modify: `apps/api/src/approval.ts` (already has failure; confirm `runConversationTurn` passes it)

**Interfaces:**
- Consumes: `activeRequest.product`, `approvedBookingReply`, `failedBookingReply`, `computeArrivalTarget` / 15-minute offset, `getUberProvider` via `invokeTool`
- Produces: shared `pickBookingOption(sessionId, product?)`; spoken product words; confirmation or retry failure after the second yes

- [ ] **Step 1: Write the failing conversation tests**

Add to `apps/api/src/conversation.test.ts` (keep `resetControlledUberProvider()` in `beforeEach`):

```ts
it("opens the WAV checkpoint when Maria chooses the accessible Uber", async () => {
  await turn("Get me a ride to my doctor tomorrow");
  const reply = await turn("Choose the accessible one");
  expect(reply.kind).toBe("proposal");
  expect(reply.reply).toBe("The Uber is $24.50. Should I book it?");
  expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
  expect(reply.pendingApproval?.estimate).toBe("$24.50");
});

it("opens the UberX checkpoint when Maria chooses the cheaper one", async () => {
  await turn("Get me a ride to my doctor tomorrow");
  const reply = await turn("the cheaper one");
  expect(reply.kind).toBe("proposal");
  expect(reply.reply).toBe("The Uber is $18.00. Should I book it?");
  expect(reply.pendingApproval?.input).toEqual({ optionId: "uberx_1" });
  expect(reply.pendingApproval?.estimate).toBe("$18.00");
});

it("reads the wheelchair confirmation id after a second human yes", async () => {
  await turn("Get me a ride to my doctor tomorrow");
  await turn("Yes");
  const reply = await turn("Yes, book it");
  expect(reply.reply).toBe(
    "I booked the wheelchair Uber for $24.50. Your confirmation is UBER-WAV-0001.",
  );
  expect(reply.failure).toBeNull();
  expect(sessionStore.get("voice-1").lastBooking?.status).toBe("booked");
  expect(sessionStore.get("voice-1").lastBooking?.confirmationId).toBe("UBER-WAV-0001");
});

it("does not say booked when the confirmation cannot be proven", async () => {
  await turn("Get me a ride to my doctor tomorrow");
  await turn("Yes");
  resetControlledUberProvider({ failNextVerify: true });
  const reply = await turn("Yes, book it");
  expect(reply.reply).toBe(
    "I couldn't confirm that Uber booking. Nothing was charged. We can try again.",
  );
  expect(reply.reply).not.toMatch(/booked/i);
  expect(reply.failure).toMatchObject({ kind: "retry", tool: "book_ride" });
  expect(sessionStore.get("voice-1").lastBooking).toBeNull();
});

it("uses the 10:15 arrival window in the ride proposal", async () => {
  const now = new Date();
  const result = await runConversationTurn(
    { transcript: "Please get me a ride to my doctor tomorrow.", sessionId: "time-1" },
    now,
  );
  const body = conversationTurnResponseSchema.parse(result.body);
  expect(body.reply).toMatch(/10:15/);
  expect(body.reply).not.toMatch(/10:00/);
});
```

The time test is timezone-sensitive (`setHours(10, 30)` is local). If the machine is not US-local, assert with `formatTime` of `computeArrivalTarget(getMariaAppointment(now))` instead of the literal `10:15`:

```ts
import { computeArrivalTarget, getMariaAppointment } from "@kasama/shared";

const target = new Date(computeArrivalTarget(getMariaAppointment(now))).toLocaleTimeString("en-US", {
  hour: "numeric",
  minute: "2-digit",
});
expect(body.reply).toContain(target);
```

Use that form in the test (not a hardcoded `10:15`) so CI stays stable.

Also add a test that an original request can store the product:

```ts
it("remembers an accessible request until the checkpoint", async () => {
  const proposed = await turn("Get me the accessible Uber to my doctor tomorrow");
  expect(proposed.activeRequest?.product).toBe("WAV");
  const reply = await turn("Yes");
  expect(reply.pendingApproval?.input).toEqual({ optionId: "uber_wav_1" });
});
```

- [ ] **Step 2: Run conversation tests to verify the new ones fail**

Run: `pnpm --filter @kasama/api test -- src/conversation.test.ts`

Expected: FAIL — “cheaper one” still opens WAV; confirmation sentence is the new Task 1 wording only if lastBooking exists (it will after Task 3, so the third test may already pass); failNextVerify reset wipes quotes but demo ids are re-seeded so the fourth test should fail on `failure` still null if verify is not used; time test fails on the 30-minute-early sentence.

- [ ] **Step 3: Implement conversation behavior**

In `apps/api/src/conversation.ts`:

1. Parse product from normalized text:

```ts
function spokenProduct(text: string): "UberX" | "WAV" | undefined {
  if (/\b(accessible|wav|wheelchair)\b/.test(text)) return "WAV";
  if (/\b(cheaper|uberx|uber x|regular)\b/.test(text)) return "UberX";
  return undefined;
}
```

2. Change `pickBookingOption` to take `product`:

```ts
function pickBookingOption(
  sessionId: string,
  product?: "UberX" | "WAV",
): { optionId: string; estimate?: string } {
  const options = sessionStore.get(sessionId).lastRideOptions;
  const preferred = product
    ? options.find((option) => option.product === product)
    : options.find((option) => option.product === "WAV" || option.accessible);
  const option = preferred ?? options[0];
  return {
    optionId: option?.optionId ?? DEMO_UBER_WAV_OPTION_ID,
    estimate: option?.estimate,
  };
}
```

3. `openBookingCheckpoint` uses `active.product`.

4. On a ride proposal, a product phrase or a bare yes accepts the plan:

```ts
if (active?.intent === "ride" && active.status === "proposed") {
  if (saysNo) { /* unchanged */ }
  const product = spokenProduct(text) ?? (saysYes ? (active.product ?? "WAV") : undefined);
  if (product) {
    return {
      text: "Okay. I'll get the Uber ready. You'll see it on screen and confirm before anything is booked.",
      kind: "answer",
      activeRequest: { ...active, product, status: "accepted" },
    };
  }
}
```

5. `proposeRideToAppointment` takes the original normalized transcript (or a `product` argument). Set `activeRequest.product` from `spokenProduct`. Replace the 30-minute pickup with a 15-minute arrival:

```ts
const arriveBy = new Date(appointment.start);
arriveBy.setMinutes(arriveBy.getMinutes() - 15);
searchRides(sessionId, destination, arriveBy.toISOString());
// spoken: "around ${formatTime(arriveBy.toISOString())} so you arrive with time to spare"
```

6. In `runConversationTurn`, when resolving a pending approval, pass `failure: resolved.failure` (do not hardcode `null`).

- [ ] **Step 4: Run conversation + API tests**

Run:

```sh
pnpm --filter @kasama/api test
pnpm --filter @kasama/shared test
```

Expected: PASS. Existing “Yes” after the plan still opens the $24.50 WAV checkpoint.

- [ ] **Step 5: Commit** (skip unless the human asked)

```bash
git add apps/api/src/conversation.ts apps/api/src/conversation.test.ts apps/api/src/approval.ts
git commit -m "$(cat <<'EOF'
Let Maria pick WAV or UberX by voice and read back a proven Uber confirmation.

EOF
)"
```

---

### Task 5: Canonical docs

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes: behavior from Tasks 1–4
- Produces: docs that match the code (controlled Uber provider; live Uber is #14; calendar still seeded)

- [ ] **Step 1: Update ARCHITECTURE.md**

Replace the **Uber** section with:

```markdown
## Uber

Booking is through Uber. `find_ride_options` / `book_ride` go through `apps/api/src/uber-provider.ts` (`UberProvider.findOptions` / `book`). This issue ships a controlled in-process implementation: two products (UberX ~$18, WAV ~$24.50), speakable confirmation ids (`UBER-WAV-0001`), and `success: true` only when the provider can re-read the booking it just wrote. Policy still requires a human token to book.

Live Uber (official API or Browserbase) is issue `#14`. A later adapter implements the same `UberProvider` interface. Until then the product names and confirmation still read as Uber, not a generic cab.
```

In **What is not built yet**, remove live calendar + Uber `#7` from the “not built” list. Keep `#14` as live Uber. Change the calendar sentence to: `get_appointment` still uses Maria’s seed (live calendar is out of scope; Composio later if cheap). Change the voice-loop paragraph so `find_ride_options` / `book_ride` are the controlled provider, not “stub … live Uber is still #14” for execute. Live execute remains `#14`.

- [ ] **Step 2: Update AGENTS.md**

Replace `Calendar and Uber are **stubs**. Policy and audit are real. Live Uber is later (\`#14\` / \`#7\`).` with:

```markdown
Calendar is **seeded** (`get_appointment` for Maria’s tomorrow appointment). Uber search and book use a controlled in-process provider (`apps/api/src/uber-provider.ts`). Policy and audit are real. Live Uber is `#14`.
```

In **Current API**, keep the tool list. Add that `book_ride` returns `status: "booked"` and a confirmation id after a human yes, or `success: false` if the confirmation cannot be proven.

- [ ] **Step 3: Typecheck and full test**

Run:

```sh
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit** (skip unless the human asked)

```bash
git add ARCHITECTURE.md AGENTS.md
git commit -m "$(cat <<'EOF'
Document the controlled Uber provider and keep live Uber on #14.

EOF
)"
```

---

## Self-review

**Spec coverage**

| Spec requirement | Task |
|---|---|
| API-local `UberProvider` (`findOptions`, `book`) | 2 |
| Process-local quotes + bookings; demo ids; seed quotes | 2 |
| `book` re-read; `failNextVerify` factory hook | 2 |
| Confirmation `UBER-{PRODUCT}-{NNNN}` global counter | 2 |
| `invokeTool` calls provider; policy unchanged | 3 |
| HTTP 200 + `success: false` on unknown option | 3 |
| `lastBooking` only when `booked` | 3 |
| Seeded calendar unchanged | (already exists; not rewritten) |
| Voice product choice + default WAV | 4 |
| Product on original request | 4 |
| Shared picker for rules + harness (`active.product`) | 4 (`openBookingCheckpoint` used by both) |
| 15-minute / 10:15 arrival language | 4 |
| Spoken confirmation / failed book / `failure.kind === "retry"` | 1 + 4 |
| Canonical docs only; SAFETY unchanged | 5 |
| Out of scope: Composio calendar, #8, Browserbase, designed UI | honored (not in file map) |

**Placeholder scan:** No TBD/TODO. Commands and code are spelled out.

**Type consistency:** `UberProvider.findOptions` / `book`; `createControlledUberProvider({ failNextVerify })`; `getUberProvider` / `resetControlledUberProvider`; `approvedBookingReply({ estimate, product, confirmationId })`; `failedBookingReply()`; `activeRequest.product`; `ResolvedApproval.failure`.
