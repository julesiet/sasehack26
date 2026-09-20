# Issue 11 Family Email Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish GitHub issue 11 so Maria can preview and confirm a family email from Chat, the caretaker sees draft/sent/cancelled FAMILY UPDATE cards, the care-notes contact button can send, and every real email goes only to `juleselvandrade@gmail.com`.

**Architecture:** Keep `notify_caretaker` as the only Kasama tool. Display recipient is a family contact (James Alvarez, Jules, Sarah, Emily). Delivery address is always `COMPOSIO_CARETAKER_RECIPIENT`. Draft is automatic (`preview`, not sent). Send needs a human `approvalToken` (actor ≠ `model`). Composio `GMAIL_SEND_EMAIL` is used when `COMPOSIO_API_KEY` is set; otherwise the existing mock send keeps CI green. Senior Chat shows a MESSAGE TO card. Caretaker Overview shows a FAMILY UPDATE card. Care-aware “Notify daughter” / contact starts the same tool on the shared `default` session.

**Tech Stack:** pnpm workspaces, Zod in `packages/shared`, Hono API, Expo iOS, Composio Gmail, vitest, `pnpm playground`.

## Global Constraints

- Product AI is **Kasama**. Never call it “the AI agent” in UI or docs.
- iOS-only Expo Go. No Android, no Next.js, no `expo prebuild`.
- Tool and permission source of truth is `packages/shared` (`tools.ts`, `policy.ts`). Docs must match the code.
- Book / send / spend still need a human `approvalToken`, actor ≠ `model`. Model cannot self-approve.
- Every delivered email uses recipient `juleselvandrade@gmail.com` (`COMPOSIO_CARETAKER_RECIPIENT`). Never send to another address even if the spoken name is James, Sarah, or Emily.
- Jules must be a selectable family member. James Alvarez remains selectable and is the default display recipient.
- Senior preview copy (verbatim):

```text
MESSAGE TO
James Alvarez

Preview only.
Nothing is sent yet.

Maria missed her medication reminder.

Urgency
Normal

[ Cancel ]        [ Confirm ]
```

- Caretaker draft copy (verbatim):

```text
FAMILY UPDATE

Draft — awaiting confirmation

Maria missed her medication reminder.

Urgency: Normal
Recipient: James Alvarez
```

- Caretaker sent copy (verbatim pattern):

```text
FAMILY UPDATE

Sent

Maria missed her medication reminder.

Sent to James Alvarez
Today at 10:42 AM
Urgency: Normal
```

- Caretaker cancelled copy (verbatim):

```text
FAMILY UPDATE

Not sent

Maria cancelled this message.
```

- CI must pass without `COMPOSIO_API_KEY`, `MODEL_API_KEY`, or `ELEVENLABS_API_KEY`.
- Failed tools still return `failure.kind` `retry` or `handoff`.
- Work on branch `fix/issue-11-caretaker-notification` in `/Users/mawer/sasehack26`. Do not switch branches. Do not push.
- Commit after each task (SDD review needs a commit range). Do not amend unless the SDD amend rules are met.
- Update `AGENTS.md`, `ARCHITECTURE.md`, and `docs/SAFETY.md` in the same change that wires Composio into `notify_caretaker`.
- Tap targets ≥ 68pt on senior actions. Care language is “worth reviewing,” never a diagnosis.
- Do not invent a second chat store. Session projection stays `GET /sessions/:sessionId`.

## File map

- Modify: `apps/api/src/invoke-tool.ts` — merge conflict, async stub, Composio send + mock fallback
- Modify: `packages/shared/src/seed.ts` — Jules + James Alvarez family contacts
- Create: `packages/shared/src/family.ts` — resolve spoken name → family contact; pin delivery email
- Modify: `packages/shared/src/tools.ts` — notify input/result include display recipient
- Modify: `packages/shared/src/session.ts` — caretaker activity stores recipient
- Modify: `packages/shared/src/conversation.ts` — `family_update` intent + chat title
- Modify: `apps/api/src/conversation.ts` — parse “send an email to … saying …”
- Modify: `apps/api/src/session-store.ts` — persist recipient on activity
- Modify: `packages/shared/src/caretaker-dashboard.ts` — FAMILY UPDATE projection
- Create: `apps/mobile/src/components/FamilyMessageCard.tsx` — senior MESSAGE TO card
- Create: `apps/mobile/src/components/caretaker/FamilyUpdateCard.tsx` — caretaker card
- Modify: `apps/mobile/src/screens/SeniorChatScreen.tsx` — show MESSAGE TO, not ride ConfirmationCard
- Modify: `apps/mobile/src/screens/CaretakerScreen.tsx` — render FAMILY UPDATE
- Modify: `apps/mobile/src/screens/CareAwareScreen.tsx` — contact / Notify daughter sends
- Modify: `apps/mobile/src/lib/api.ts` — tool invoke + caretaker actor on approvals
- Modify: canonical docs in Task 8

---

### Task 1: Resolve the in-progress merge

**Files:**
- Modify: `apps/api/src/invoke-tool.ts` (unmerged `UU`)
- Test: `apps/api/src/care-signal.test.ts`

**Interfaces:**
- Consumes: incoming merge of `main` into `fix/issue-11-caretaker-notification`
- Produces: compiling `executeStub` that is `async`, still contains `computeCareSignal` from `main`, and still has HEAD’s Composio `notify_caretaker` send (tests may still fail until Task 3)

There is one conflict, around the `executeStub` signature. HEAD made it `async` so Gmail send can `await kasamaComposio.execute`. `main` added `computeCareSignal` plus `USUAL_SLEEP_HOURS` / `REPEATED_QUESTION_THRESHOLD` / `firstName`. Keep **both**.

- [ ] **Step 1: Replace the conflict hunk**

In `apps/api/src/invoke-tool.ts`, delete both conflict markers and keep this order: helpers from `main`, then `async function executeStub`.

The resolved region must be:

```ts
/** Below this, a night counts as "less sleep than usual" for the weekly care signal. */
const USUAL_SLEEP_HOURS = 7;
/** This many same-topic repeats in the window counts as a "repeated question" signal. */
const REPEATED_QUESTION_THRESHOLD = 2;

function firstName(fullName: string): string {
  return fullName.split(" ")[0] ?? fullName;
}

function computeCareSignal(): {
  summary: string;
  actions: CareSignalAction[];
  diagnosis: false;
} {
  const seed = getMariaSeedBundle();
  const name = firstName(seed.profile.name);

  const flaggedCount = seed.priorRequests.filter((request) => request.flaggedConfusion).length;
  const repeatedQuestion = flaggedCount >= REPEATED_QUESTION_THRESHOLD;

  const averageSleepHours =
    seed.wearableReadings.reduce((total, reading) => total + reading.sleepHours, 0) /
    seed.wearableReadings.length;
  const lessSleep = averageSleepHours < USUAL_SLEEP_HOURS;

  const clauses: string[] = [];
  if (repeatedQuestion) clauses.push(`${name} asked about the same appointment twice`);
  if (lessSleep) clauses.push("slept less than usual this week");

  if (clauses.length === 0) {
    return {
      summary: `Nothing unusual to review for ${name} this week.`,
      actions: [],
      diagnosis: false,
    };
  }

  const actions: CareSignalAction[] = ["remind", "notify_caretaker"];
  if (repeatedQuestion && lessSleep) actions.push("doctor_summary");

  return {
    summary: `${clauses.join(" and ")}.`,
    actions,
    diagnosis: false,
  };
}

async function executeStub(name: ToolName, input: unknown, options?: { preview?: boolean }) {
```

Do not delete the `notify_caretaker` Composio `await` body that already exists below the conflict. Do not delete `case "get_care_signal"`. Keep existing imports (`kasamaComposio`, `COMPOSIO_GMAIL_SEND_TOOL`, `getCareSignalResultSchema`, `CareSignalAction`).

- [ ] **Step 2: Mark resolved and typecheck**

```sh
git add apps/api/src/invoke-tool.ts
pnpm typecheck
```

Expected: typecheck passes, or only pre-existing notify/Zod errors unrelated to conflict markers. File must contain **zero** `<<<<<<<`, `=======`, `>>>>>>>` markers.

- [ ] **Step 3: Confirm care-signal tests still exist**

```sh
pnpm exec vitest run apps/api/src/care-signal.test.ts packages/shared/src/care-aware.test.ts
```

Expected: PASS. If `invoke-tool` no longer has `computeCareSignal`, this fails.

- [ ] **Step 4: Complete the merge commit**

```bash
git add apps/api/src/invoke-tool.ts
git status
git commit -m "$(cat <<'EOF'
Merge main into fix/issue-11-caretaker-notification.

Keep async notify send and the care-signal stub from main.
EOF
)"
```

Do not abort the merge. Do not leave `UU` paths.

---

### Task 2: Family members and notify recipient contract

**Files:**
- Modify: `packages/shared/src/seed.ts`
- Create: `packages/shared/src/family.ts`
- Create: `packages/shared/src/family.test.ts`
- Modify: `packages/shared/src/tools.ts`
- Modify: `packages/shared/src/session.ts`
- Modify: `packages/shared/src/seed.test.ts`
- Modify: `packages/shared/src/caretaker-dashboard.test.ts`
- Modify: `packages/shared/src/index.ts` (only if `family.ts` is not already re-exported; `export * from "./seed"` is enough if helpers live next to seed — **put helpers in `family.ts` and add `export * from "./family"`**)

**Interfaces:**
- Consumes: `MARIA_FAMILY_CONTACTS`, `COMPOSIO_CARETAKER_RECIPIENT`, `notifyCaretakerInputSchema`
- Produces:
  - `MARIA_FAMILY_CONTACTS` includes Jules and James Alvarez
  - `resolveFamilyRecipient(spoken: string): FamilyContact`
  - `FAMILY_EMAIL_RECIPIENT = "juleselvandrade@gmail.com"` (re-export of `COMPOSIO_CARETAKER_RECIPIENT`, do not duplicate the string)
  - `notifyCaretakerInputSchema` fields `recipientId` and `recipientName` (optional, defaulted by resolver at call sites)
  - `notifyCaretakerResultSchema.draft` includes those fields plus `recipientEmail`
  - `caretakerActivityItemSchema` optional `recipientId` / `recipientName`

- [ ] **Step 1: Write failing family tests**

Create `packages/shared/src/family.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { FAMILY_EMAIL_RECIPIENT, resolveFamilyRecipient } from "./family";
import { getMariaSeedBundle } from "./seed";

describe("family recipients", () => {
  it("lists Jules and James Alvarez as family members", () => {
    const names = getMariaSeedBundle().familyContacts.map((contact) => contact.name);
    expect(names).toContain("Jules");
    expect(names).toContain("James Alvarez");
  });

  it("resolves spoken James, Jules, Sarah, Emily, daughter, son, and family", () => {
    expect(resolveFamilyRecipient("james alvarez").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("jules").name).toBe("Jules");
    expect(resolveFamilyRecipient("sarah").name).toBe("Sarah");
    expect(resolveFamilyRecipient("emily").name).toBe("Emily");
    expect(resolveFamilyRecipient("daughter").name).toBe("Sarah");
    expect(resolveFamilyRecipient("son").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("family").name).toBe("James Alvarez");
    expect(resolveFamilyRecipient("").name).toBe("James Alvarez");
  });

  it("always delivers to Jules's Gmail even when the display name is James", () => {
    expect(FAMILY_EMAIL_RECIPIENT).toBe("juleselvandrade@gmail.com");
    expect(FAMILY_EMAIL_RECIPIENT).toBe(COMPOSIO_CARETAKER_RECIPIENT);
    expect(resolveFamilyRecipient("james alvarez").id).not.toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```sh
pnpm exec vitest run packages/shared/src/family.test.ts
```

Expected: FAIL (module or contacts missing).

- [ ] **Step 3: Implement seed + resolver + schemas**

In `packages/shared/src/seed.ts`, change `MARIA_FAMILY_CONTACTS` to:

```ts
export const MARIA_FAMILY_CONTACTS: FamilyContact[] = [
  familyContactSchema.parse({ id: "contact_sarah", name: "Sarah", initial: "S" }),
  familyContactSchema.parse({ id: "contact_james", name: "James Alvarez", initial: "J" }),
  familyContactSchema.parse({ id: "contact_emily", name: "Emily", initial: "E" }),
  familyContactSchema.parse({ id: "contact_jules", name: "Jules", initial: "U" }),
];
```

Jules’s initial is `"U"` so the two J contacts stay distinct on the chip row (`J` vs `U`). If the designed row cannot fit four chips, keep four anyway — wrapping is fine.

Create `packages/shared/src/family.ts`:

```ts
import { COMPOSIO_CARETAKER_RECIPIENT } from "./composio";
import { MARIA_FAMILY_CONTACTS, type FamilyContact } from "./seed";

export const FAMILY_EMAIL_RECIPIENT = COMPOSIO_CARETAKER_RECIPIENT;
export const DEFAULT_FAMILY_CONTACT_ID = "contact_james";

const ALIASES: Array<{ pattern: RegExp; id: string }> = [
  { pattern: /\bjules\b/i, id: "contact_jules" },
  { pattern: /\b(james(\s+alvarez)?|son|caretaker)\b/i, id: "contact_james" },
  { pattern: /\b(sarah|daughter)\b/i, id: "contact_sarah" },
  { pattern: /\bemily\b/i, id: "contact_emily" },
];

export function resolveFamilyRecipient(spoken = ""): FamilyContact {
  const text = spoken.trim();
  const match = ALIASES.find((alias) => alias.pattern.test(text));
  const id = match?.id ?? DEFAULT_FAMILY_CONTACT_ID;
  return MARIA_FAMILY_CONTACTS.find((contact) => contact.id === id) ?? MARIA_FAMILY_CONTACTS[1]!;
}

export function withNotifyRecipient<T extends { summary: string; urgency: "low" | "normal" | "high" }>(
  draft: T,
  spoken = "",
): T & { recipientId: string; recipientName: string; recipientEmail: string } {
  const recipient = resolveFamilyRecipient(spoken || draft && "recipientName" in draft ? String((draft as { recipientName?: string }).recipientName ?? spoken) : spoken);
  return {
    ...draft,
    recipientId: recipient.id,
    recipientName: recipient.name,
    recipientEmail: FAMILY_EMAIL_RECIPIENT,
  };
}
```

Keep `withNotifyRecipient` simple — if the nested ternary is messy, write:

```ts
export function withNotifyRecipient(draft: {
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientId?: string;
  recipientName?: string;
}): {
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientId: string;
  recipientName: string;
  recipientEmail: string;
} {
  const recipient = draft.recipientId
    ? MARIA_FAMILY_CONTACTS.find((contact) => contact.id === draft.recipientId)
    : resolveFamilyRecipient(draft.recipientName ?? "");
  const resolved = recipient ?? resolveFamilyRecipient("");
  return {
    summary: draft.summary,
    urgency: draft.urgency,
    recipientId: resolved.id,
    recipientName: resolved.name,
    recipientEmail: FAMILY_EMAIL_RECIPIENT,
  };
}
```

In `packages/shared/src/tools.ts`, extend notify schemas:

```ts
export const notifyCaretakerInputSchema = z.object({
  summary: z.string().min(1),
  urgency: caretakerUrgencySchema,
  recipientId: z.string().min(1).optional(),
  recipientName: z.string().min(1).optional(),
});

export const notifyCaretakerDraftSchema = z.object({
  summary: z.string(),
  urgency: caretakerUrgencySchema,
  recipientId: z.string().optional(),
  recipientName: z.string().optional(),
  recipientEmail: z.string().email().optional(),
});

export const notifyCaretakerResultSchema = z.object({
  success: z.boolean(),
  confirmationId: z.string().optional(),
  summary: z.string(),
  preview: z.boolean().optional(),
  sent: z.boolean().optional(),
  draft: notifyCaretakerDraftSchema.optional(),
});
```

In `packages/shared/src/session.ts`, add optional recipient fields to `caretakerActivityItemSchema`:

```ts
  recipientId: z.string().optional(),
  recipientName: z.string().optional(),
```

Export family from `packages/shared/src/index.ts`:

```ts
export * from "./family";
```

Update `packages/shared/src/seed.test.ts` and `packages/shared/src/caretaker-dashboard.test.ts` expected names to `["Sarah", "James Alvarez", "Emily", "Jules"]`.

- [ ] **Step 4: Run tests**

```sh
pnpm exec vitest run packages/shared/src/family.test.ts packages/shared/src/seed.test.ts packages/shared/src/caretaker-dashboard.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/family.ts packages/shared/src/family.test.ts packages/shared/src/seed.ts packages/shared/src/tools.ts packages/shared/src/session.ts packages/shared/src/index.ts packages/shared/src/seed.test.ts packages/shared/src/caretaker-dashboard.test.ts
git commit -m "$(cat <<'EOF'
Add Jules as a family contact and pin display recipients for notify.

Delivery stays juleselvandrade@gmail.com; James Alvarez remains the default name on cards.
EOF
)"
```

---

### Task 3: Send through Composio without breaking CI

**Files:**
- Modify: `apps/api/src/invoke-tool.ts`
- Modify: `apps/api/src/session-store.ts`
- Modify: `apps/api/src/app.test.ts`
- Modify: `apps/api/src/playground.test.ts`
- Modify: `apps/api/src/conversation.ts` (only the missing `await` on `openNotifyCheckpoint` if still present)

**Interfaces:**
- Consumes: `withNotifyRecipient`, `FAMILY_EMAIL_RECIPIENT`, `kasamaComposio.execute`, `COMPOSIO_GMAIL_SEND_TOOL`
- Produces: preview never calls Gmail send; human send uses Composio when configured, otherwise mock; activity stores recipient; conversation turn no longer returns a Promise as the reply (Zod crash)

Known bugs from the unfinished branch:

1. `openNotifyCheckpoint` is `async` but `runRulesTurn` does `const opened = openNotifyCheckpoint(...)` without `await`, so `opened.text` is undefined and session Zod parsing fails.
2. `app.test.ts` expects send summary to match `/email|sms/i` and does not mock Composio, so live execute throws or returns `successful: false`.
3. Draft `toEqual({ summary, urgency })` will fail after Task 2 unless tests allow extra recipient fields.

- [ ] **Step 1: Write / update failing tests**

In `apps/api/src/app.test.ts`, change the send test to:

```ts
  it("sends a caretaker email to Jules's Gmail with a human approval token", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute").mockResolvedValue({
      userId: "senior_maria",
      sessionId: "composio_session",
      toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      successful: true,
      logId: "gmail_send_1",
    });

    const res = await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: {
          summary: "Maria missed her medication reminder.",
          urgency: "normal",
          recipientName: "James Alvarez",
        },
        actor: "senior",
        approvalToken: "tok_yes",
        sessionId: "notify-send-1",
      }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(true);
    expect(body.preview).toBe(false);
    expect(body.draft.recipientEmail).toBe("juleselvandrade@gmail.com");
    expect(body.draft.recipientName).toBe("James Alvarez");
    expect(executeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
        arguments: expect.objectContaining({
          recipient_email: "juleselvandrade@gmail.com",
          body: "Maria missed her medication reminder.",
        }),
      }),
    );
    executeSpy.mockRestore();
  });
```

Add a test that preview does not call Composio:

```ts
  it("does not call Gmail when notify_caretaker is only a preview", async () => {
    const { kasamaComposio } = await import("./composio");
    const executeSpy = vi.spyOn(kasamaComposio, "execute");
    await app.request("/tools/notify_caretaker", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: { summary: "Maria is running late.", urgency: "high" },
        actor: "model",
        sessionId: "notify-draft-no-gmail",
      }),
    });
    expect(executeSpy).not.toHaveBeenCalled();
    executeSpy.mockRestore();
  });
```

Add a fallback test: when Composio throws `ComposioNotConfiguredError`, send still succeeds as a mock so CI without a key works. Spy `execute` to `mockRejectedValue(new ComposioNotConfiguredError())` and expect `sent: true`, `confirmationId` matching `/notify_/`, summary matching `/email/i`.

Relax `body.draft` exact equality in the existing draft test to `toMatchObject({ summary, urgency })`.

- [ ] **Step 2: Run the notify tests to see RED**

```sh
pnpm exec vitest run apps/api/src/app.test.ts apps/api/src/conversation.test.ts apps/api/src/playground.test.ts
```

Expected: FAIL on send/preview/Zod until implementation.

- [ ] **Step 3: Implement send + await the notify checkpoint**

In `apps/api/src/invoke-tool.ts` `case "notify_caretaker"`:

```ts
    case "notify_caretaker": {
      const parsed = withNotifyRecipient(notifyCaretakerInputSchema.parse(input));
      if (options?.preview) {
        return notifyCaretakerResultSchema.parse({
          success: true,
          summary: `Draft for ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary} Not sent.`,
          preview: true,
          sent: false,
          draft: parsed,
        });
      }

      const mockSend = () =>
        notifyCaretakerResultSchema.parse({
          success: true,
          confirmationId: `notify_${Date.now()}`,
          summary: `Email sent to ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary}`,
          preview: false,
          sent: true,
          draft: parsed,
        });

      try {
        const composioResult = await kasamaComposio.execute({
          toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
          arguments: {
            recipient_email: FAMILY_EMAIL_RECIPIENT,
            body: parsed.summary,
            subject: `Note from Kasama about Maria (${parsed.urgency} urgency)`,
          },
        });

        if (!composioResult.successful) {
          if (composioResult.needsAuth || composioResult.error?.includes("not configured")) {
            return mockSend();
          }
          return notifyCaretakerResultSchema.parse({
            success: false,
            summary: `Failed to send notification: ${composioResult.error ?? "Gmail send failed."}`,
            preview: false,
            sent: false,
            draft: parsed,
          });
        }

        return notifyCaretakerResultSchema.parse({
          success: true,
          confirmationId: composioResult.logId ?? `composio_${Date.now()}`,
          summary: `Email sent to ${parsed.recipientName} (${parsed.urgency}): ${parsed.summary}`,
          preview: false,
          sent: true,
          draft: parsed,
        });
      } catch (e) {
        if (e instanceof ComposioNotConfiguredError) {
          return mockSend();
        }
        return notifyCaretakerResultSchema.parse({
          success: false,
          summary: `Unexpected error sending notification: ${e instanceof Error ? e.message : String(e)}`,
          preview: false,
          sent: false,
          draft: parsed,
        });
      }
    }
```

Import `withNotifyRecipient`, `FAMILY_EMAIL_RECIPIENT`, `ComposioNotConfiguredError`.

In `apps/api/src/session-store.ts` `appendCaretakerActivity`, persist `recipientId` / `recipientName` from `withNotifyRecipient(notifyCaretakerInputSchema.parse(input))`.

In `apps/api/src/conversation.ts`, **await** the checkpoint:

```ts
  if (NOTIFY.test(text) && !RIDE.test(text)) {
    return await openNotifyCheckpoint(sessionId, draftNotifySummary(transcript), text);
  }
```

Update `openNotifyCheckpoint` to accept the transcript and pass `withNotifyRecipient({ summary, urgency: "normal", recipientName: resolveFamilyRecipient(transcript).name })` into `invokeTool`.

Remove the `console.log` in `get_appointment` if it is still there (test noise).

- [ ] **Step 4: Run tests**

```sh
pnpm exec vitest run apps/api/src/app.test.ts apps/api/src/conversation.test.ts apps/api/src/playground.test.ts apps/api/src/care-signal.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Send notify_caretaker mail to Jules after a human yes.

Preview stays local; CI falls back to a mock when Composio is not configured.
EOF
)"
```

---

### Task 4: Conversation parses “send an email to …”

**Files:**
- Modify: `packages/shared/src/conversation.ts`
- Modify: `packages/shared/src/conversation.test.ts`
- Modify: `apps/api/src/conversation.ts`
- Modify: `apps/api/src/conversation.test.ts`
- Modify: `apps/api/src/harness.ts` (tool schema for notify: include optional recipient fields)

**Interfaces:**
- Consumes: `resolveFamilyRecipient`, `openNotifyCheckpoint`
- Produces: intent `family_update`; chat title `Family update`; transcript `send an email to james alvarez saying i missed my medication` drafts that summary to James Alvarez (email still Jules)

- [ ] **Step 1: Write failing conversation tests**

In `apps/api/src/conversation.test.ts` add:

```ts
  it("previews an email to James Alvarez from a spoken send request", async () => {
    const draft = await turn("send an email to james alvarez saying i missed my medication");
    expect(draft.kind).toBe("proposal");
    expect(draft.pendingApproval?.tool).toBe("notify_caretaker");
    expect(draft.pendingApproval?.preview).toMatch(/missed.*medication/i);
    const input = sessionStore.get("voice-1").pendingApproval?.input as {
      recipientName?: string;
      summary?: string;
      urgency?: string;
    };
    expect(input.recipientName).toBe("James Alvarez");
    expect(input.urgency).toBe("normal");
    expect(input.summary).toMatch(/missed her medication/i);
    expect(sessionStore.get("voice-1").caretakerActivity.some((item) => item.sent)).toBe(false);
  });

  it("previews an email when Maria names Jules", async () => {
    const draft = await turn("send an email to jules saying I am going to the doctor");
    const input = sessionStore.get("voice-1").pendingApproval?.input as { recipientName?: string };
    expect(input.recipientName).toBe("Jules");
  });
```

Use a unique session id per test if `voice-1` is shared via `beforeEach` — follow the existing `turn()` helper.

In `packages/shared/src/conversation.test.ts` add that `chatTitleForIntent("family_update")` is `"Family update"`.

- [ ] **Step 2: Run to verify RED**

```sh
pnpm exec vitest run apps/api/src/conversation.test.ts packages/shared/src/conversation.test.ts
```

Expected: FAIL (`family_update` not in enum; email phrasing not matched).

- [ ] **Step 3: Implement parsing**

Add `"family_update"` to `conversationIntentSchema`.

```ts
export function chatTitleForIntent(intent: ConversationIntent, destination?: string): string {
  switch (intent) {
    case "ride":
      return destination && DOCTOR_PLACE.test(destination) ? "Doctor ride" : "Ride";
    case "medication_reminder":
      return "Medication reminder";
    case "hospital_schedule":
      return "Hospital visit";
    case "appointment_info":
      return "Appointment";
    case "family_update":
      return "Family update";
    default:
      return "New chat";
  }
}
```

In `apps/api/src/conversation.ts` expand NOTIFY and extract body/recipient:

```ts
const NOTIFY =
  /\b(tell|text|message|notify|email|e-mail|send (an |a )?(email|e-mail|message)|let (my )?(family|son|daughter|james|jules|caretaker) know)\b/;

function notifyBodyFromTranscript(transcript: string): string {
  const saying = transcript.match(/\b(?:saying|that|about)\s+(.+)$/i);
  const raw = saying?.[1]?.trim() || transcript.trim();
  if (/missed.{0,40}medication/i.test(raw)) {
    return "Maria missed her medication reminder.";
  }
  if (DOCTOR.test(normalize(raw))) {
    return "Maria is going to her doctor's appointment.";
  }
  return `Maria asked me to let you know: ${raw.replace(/^(that\s+)/i, "")}`;
}
```

`openNotifyCheckpoint` must set `activeRequest: { intent: "family_update", status: "proposed" }` via session conversation (the harness return’s `activeRequest`). Pass recipient from `resolveFamilyRecipient(transcript)`.

Match email even when `RIDE` is also in the string? Prefer notify when `NOTIFY` matches and the utterance is clearly send-a-message (`email|message|tell|notify`) even if “take me” is absent. Keep `!RIDE.test(text)` for the existing family-notify path so “tell my family I’m getting an Uber” can still be a ride if that’s current behavior — **do not change ride tests**. If a new email test collides with RIDE, drop RIDE-exclusion only when `/\bemail\b/` matches.

- [ ] **Step 4: Run tests**

```sh
pnpm exec vitest run apps/api/src/conversation.test.ts packages/shared/src/conversation.test.ts
pnpm typecheck
```

Expected: PASS, including existing ride/notify tests.

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Parse spoken family emails and title the thread Family update.

James Alvarez and Jules resolve as display names; the draft is still preview-only.
EOF
)"
```

---

### Task 5: Senior MESSAGE TO card

**Files:**
- Create: `apps/mobile/src/components/FamilyMessageCard.tsx`
- Modify: `apps/mobile/src/screens/SeniorChatScreen.tsx`
- Modify: `apps/mobile/src/lib/mvp-confirmation.ts` (stop routing notify through the ride ConfirmationCard)
- Modify: `docs/CONVENTIONS.md` (one line listing the new card)

**Interfaces:**
- Consumes: `pendingApproval.tool === "notify_caretaker"`, draft `summary` / `urgency` / `recipientName`
- Produces: large-type Cancel / Confirm card with the exact MESSAGE TO copy

There are no mobile vitest files. Put presentational helpers in `mvp-confirmation.ts` and unit-test those in a colocated `apps/mobile/src/lib/mvp-confirmation.test.ts` **only if** the mobile package already runs vitest. Prefer testing copy builders in `packages/shared` if adding a mobile test runner is extra. Simplest: add `familyMessageCardCopy` to `packages/shared/src/family.ts` and test it in `family.test.ts`.

- [ ] **Step 1: Failing copy tests in `packages/shared/src/family.test.ts`**

```ts
  it("builds the senior MESSAGE TO preview copy", () => {
    const card = familyMessageCardCopy({
      recipientName: "James Alvarez",
      summary: "Maria missed her medication reminder.",
      urgency: "normal",
      status: "pending",
    });
    expect(card.eyebrow).toBe("MESSAGE TO");
    expect(card.recipientName).toBe("James Alvarez");
    expect(card.intro).toBe("Preview only.\nNothing is sent yet.");
    expect(card.summary).toBe("Maria missed her medication reminder.");
    expect(card.urgencyLabel).toBe("Normal");
  });
```

- [ ] **Step 2: Run RED**

```sh
pnpm exec vitest run packages/shared/src/family.test.ts
```

- [ ] **Step 3: Implement helper + card + wire Chat**

Add `familyMessageCardCopy` to `packages/shared/src/family.ts`:

```ts
export function titleCaseUrgency(urgency: "low" | "normal" | "high"): string {
  return urgency === "low" ? "Low" : urgency === "high" ? "High" : "Normal";
}

export function familyMessageCardCopy(input: {
  recipientName: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  status: "pending" | "sent" | "cancelled";
}): {
  eyebrow: string;
  recipientName: string;
  intro: string;
  summary: string;
  urgencyLabel: string;
} {
  return {
    eyebrow: "MESSAGE TO",
    recipientName: input.recipientName,
    intro:
      input.status === "pending"
        ? "Preview only.\nNothing is sent yet."
        : input.status === "sent"
          ? "Sent."
          : "Not sent.",
    summary: input.summary,
    urgencyLabel: titleCaseUrgency(input.urgency),
  };
}
```

Create `apps/mobile/src/components/FamilyMessageCard.tsx` matching `MedicationReminderCard` tokens: cream/white card, 68pt Cancel / Confirm, large type. Structure:

- Eyebrow `MESSAGE TO`
- Recipient name (Georgia, large)
- Intro two lines: `Preview only.` then `Nothing is sent yet.`
- Body = summary
- Label `Urgency` + `Normal`
- Cancel / Confirm

Do **not** show this card inside `ConfirmationCard`. In `SeniorChatScreen.tsx`:

- `notifyIntent = intent === "family_update" || intent === "unknown"`
- `showNotify = liveCards && (pendingApproval?.tool === "notify_caretaker" || justResolved?.tool === "notify_caretaker")`
- Remove `notify_caretaker` from `showRideConfirmation`
- Render `<FamilyMessageCard />` when `showNotify`

Read recipient from `pendingApproval.input` (parse with `notifyCaretakerInputSchema.safeParse`) falling back to `James Alvarez`.

- [ ] **Step 4: typecheck**

```sh
pnpm typecheck
pnpm exec vitest run packages/shared/src/family.test.ts
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Show a MESSAGE TO preview on senior Chat before any family email is sent.

Cancel and Confirm stay the same 68pt checkpoint as other senior cards.
EOF
)"
```

---

### Task 6: Caretaker FAMILY UPDATE card

**Files:**
- Modify: `packages/shared/src/caretaker-dashboard.ts`
- Modify: `packages/shared/src/caretaker-dashboard.test.ts`
- Create: `apps/mobile/src/components/caretaker/FamilyUpdateCard.tsx`
- Modify: `apps/mobile/src/screens/CaretakerScreen.tsx`
- Modify: `apps/mobile/src/components/caretaker/OverviewCards.tsx` (render the new card in Overview, under ride)

**Interfaces:**
- Consumes: `view.caretakerActivity`, `view.pendingApproval`, `view.lastApproval`
- Produces: `dashboard.familyUpdate` with statuses `draft` | `sent` | `not_sent`

- [ ] **Step 1: Failing dashboard tests**

```ts
  it("projects a draft FAMILY UPDATE for a notify preview", () => {
    const dashboard = buildCaretakerDashboard({
      view: view({
        pendingApproval: {
          tool: "notify_caretaker",
          action: "notify_caretaker",
          reason: "confirmation_required",
          summary: "This action requires a confirmation token from a human.",
          prompt: "I can send this to your family. Should I send it?",
          detail: "Preview only — not sent yet.",
          preview: "Maria missed her medication reminder.",
          input: {
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            recipientName: "James Alvarez",
          },
          timestamp: NOW.toISOString(),
          status: "pending",
        },
        caretakerActivity: [
          {
            id: "act_1",
            timestamp: NOW.toISOString(),
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            sent: false,
            preview: true,
            recipientName: "James Alvarez",
          },
        ],
      }),
      seed: SEED,
      now: NOW,
    });
    expect(dashboard.familyUpdate).toEqual({
      status: "draft",
      kicker: "FAMILY UPDATE",
      headline: "Draft — awaiting confirmation",
      summary: "Maria missed her medication reminder.",
      urgencyLabel: "Normal",
      recipientName: "James Alvarez",
      sentLine: null,
      whenLabel: null,
    });
  });

  it("projects sent and cancelled FAMILY UPDATE copy", () => {
    const sent = buildCaretakerDashboard({
      view: view({
        caretakerActivity: [
          {
            id: "act_sent",
            timestamp: NOW.toISOString(),
            summary: "Maria missed her medication reminder.",
            urgency: "normal",
            sent: true,
            preview: false,
            recipientName: "James Alvarez",
          },
        ],
      }),
      seed: SEED,
      now: NOW,
    });
    expect(sent.familyUpdate).toMatchObject({
      status: "sent",
      kicker: "FAMILY UPDATE",
      headline: "Sent",
      summary: "Maria missed her medication reminder.",
      urgencyLabel: "Normal",
      recipientName: "James Alvarez",
      sentLine: "Sent to James Alvarez",
      whenLabel: formatAppointmentWhen(NOW.toISOString(), NOW),
    });

    const cancelled = buildCaretakerDashboard({
      view: view({
        lastApproval: {
          tool: "notify_caretaker",
          action: "notify_caretaker",
          decision: "declined",
          actor: "senior",
          timestamp: NOW.toISOString(),
          summary: "Okay. I will not send that message.",
          prompt: "I can send this to your family. Should I send it?",
        },
      }),
      seed: SEED,
      now: NOW,
    });
    expect(cancelled.familyUpdate).toMatchObject({
      status: "not_sent",
      kicker: "FAMILY UPDATE",
      headline: "Not sent",
      summary: "Maria cancelled this message.",
    });
  });
```

`whenLabel` uses `formatDashboardTime` (export it from `caretaker-dashboard.ts` if it is not already exported). Do not hardcode `10:42 AM`; that time is illustrative. Production uses the activity timestamp.

- [ ] **Step 2: RED**

```sh
pnpm exec vitest run packages/shared/src/caretaker-dashboard.test.ts
```

- [ ] **Step 3: Implement projection + card**

Add to `CaretakerDashboard`:

```ts
export type CaretakerFamilyUpdate = {
  status: "draft" | "sent" | "not_sent";
  kicker: "FAMILY UPDATE";
  headline: string;
  summary: string;
  urgencyLabel: string;
  recipientName: string;
  sentLine: string | null;
  whenLabel: string | null;
};

export type CaretakerDashboard = {
  // existing fields...
  familyUpdate: CaretakerFamilyUpdate | null;
};
```

Build it from the latest notify activity / pending / lastApproval. Capitalize urgency with `titleCaseUrgency`.

`FamilyUpdateCard` is a `CaretakerCard` with header icon `mail-outline`, kicker FAMILY UPDATE, then the status headline and body. No Confirm button on this card in Task 6 (caretaker confirm is Task 7). Overview still polls every 2s so a senior Confirm flips Draft → Sent.

- [ ] **Step 4: PASS**

```sh
pnpm exec vitest run packages/shared/src/caretaker-dashboard.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Show FAMILY UPDATE draft, sent, and cancelled states on the caretaker Overview.

Copy follows the senior notify checkpoint so Margaret sees the same message Maria confirmed.
EOF
)"
```

---

### Task 7: Care-notes contact button can send

**Files:**
- Modify: `apps/mobile/src/lib/api.ts`
- Modify: `apps/mobile/src/screens/CareAwareScreen.tsx`
- Modify: `apps/mobile/src/screens/CaretakerScreen.tsx`
- Modify: `packages/shared/src/care-aware.ts`
- Modify: `packages/shared/src/care-aware.test.ts`
- Modify: `apps/api/src/app.test.ts` (caretaker actor can approve notify)

**Interfaces:**
- Consumes: `DEFAULT_SESSION_ID`, `POST /tools/notify_caretaker`, `POST /approvals` with `actor: "caretaker"`
- Produces: tapping Notify daughter / the contact action drafts then, on Confirm in the sheet, sends as caretaker. Display recipient Sarah (daughter) or the tapped contact; delivery email still Jules.

Flow for the care-notes button:

1. Tap **Notify daughter** (or a contact chip if you also wire ContactsRow — required path is the care-notes page button).
2. POST `notify_caretaker` as `actor: "caretaker"` **without** token → draft on the shared session (FAMILY UPDATE = Draft).
3. Sheet shows the same preview facts (recipient, summary, urgency Normal) plus Confirm / Cancel.
4. Confirm → `POST /approvals` `{ decision: "approve", actor: "caretaker", sessionId }` OR `POST /tools/notify_caretaker` with `approvalToken` and `actor: "caretaker"`. Prefer the existing approvals route so policy stays one path.
5. Cancel → `POST /approvals` `{ decision: "decline", actor: "caretaker" }` → FAMILY UPDATE Not sent. Copy for caretaker-initiated cancel may stay “Maria cancelled this message.” if `declinedNotifyReply` is shared; **do not** invent a second decline reason in this task. If the decline actor is caretaker, headline stays `Not sent` and summary stays `Maria cancelled this message.`

Default summary for this button: `Maria missed her medication reminder.` is the demo line from the spec. Use `Maria asked about her appointment twice.` only if you already have that string in care-aware copy; otherwise use `Maria missed her medication reminder.` so the demo matches the cards.

- [ ] **Step 1: Failing tests**

Update `packages/shared/src/care-aware.test.ts` so `notify_caretaker` action `detail` is no longer “nothing was messaged”. New detail: `Opens a family update. Confirm to email Jules.` (or equivalent that does not claim nothing is sent).

Add an API test that caretaker approvals send notify (if missing):

```ts
  it("lets a caretaker confirm a notify draft", async () => {
    await app.request("/tools/notify_caretaker", { /* model draft, sessionId caretaker-notify-1 */ });
    const res = await app.request("/approvals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: "caretaker-notify-1",
        decision: "approve",
        actor: "caretaker",
      }),
    });
    expect(res.status).toBe(200);
    expect((await res.json()).lastApproval.actor).toBe("caretaker");
  });
```

Spy Composio as in Task 3.

- [ ] **Step 2: RED**

```sh
pnpm exec vitest run packages/shared/src/care-aware.test.ts apps/api/src/app.test.ts
```

- [ ] **Step 3: Implement client**

`postApproval` must take `actor: "senior" | "caretaker"` (default `"senior"` so senior Chat stays unchanged).

Add `postNotifyCaretaker` in `api.ts`:

```ts
export async function postNotifyCaretaker(input: {
  sessionId: string;
  summary: string;
  urgency: "low" | "normal" | "high";
  recipientName: string;
  actor: "senior" | "caretaker";
}): Promise<void> {
  const res = await fetch(`${apiUrl}/tools/notify_caretaker`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      input: {
        summary: input.summary,
        urgency: input.urgency,
        recipientName: input.recipientName,
      },
      actor: input.actor,
      sessionId: input.sessionId,
    }),
  });
  if (!res.ok) throw await readError(res);
}
```

`CareAwareScreen` receives `sessionId` (default session). On Notify daughter: `recipientName: "Sarah"` (daughter alias). Confirm calls `postApproval("approve", sessionId, "caretaker")`. Pass a refresh callback so Overview picks up the send on the next poll.

Update care-aware action copy so it does not say messages are not sent.

- [ ] **Step 4: PASS**

```sh
pnpm exec vitest run packages/shared/src/care-aware.test.ts apps/api/src/app.test.ts
pnpm typecheck
```

- [ ] **Step 5: Commit**

```bash
git commit -m "$(cat <<'EOF'
Let the care-notes contact action draft and send a family update.

Caretaker confirm still goes through approvals, and Gmail still only accepts Jules.
EOF
)"
```

---

### Task 8: Canonical docs and playground

**Files:**
- Modify: `AGENTS.md`
- Modify: `ARCHITECTURE.md`
- Modify: `docs/SAFETY.md`
- Modify: `docs/CONVENTIONS.md` if Task 5 did not
- Modify: `README.md` only if the Composio/notify sentence is now wrong

**Interfaces:**
- Consumes: behavior from Tasks 1–7
- Produces: docs that match code (notify is wired through policy + Composio; UI exists)

- [ ] **Step 1: Update the stale sentences**

Replace claims that `notify_caretaker` “currently mocks email/SMS” and “is not wired into conversation” with:

- Draft is automatic. Send needs a human yes.
- Send uses `GMAIL_SEND_EMAIL` to `juleselvandrade@gmail.com` when Composio is configured; otherwise a mock send so CI stays green.
- Senior Chat shows MESSAGE TO. Caretaker Overview shows FAMILY UPDATE. Care-aware Notify daughter uses the same tool.
- Jules is a family contact. Display name can be James Alvarez / Jules / Sarah / Emily.

- [ ] **Step 2: Playground the demo line**

```sh
pnpm playground -- --session-id issue-11-email "send an email to james alvarez saying i missed my medication"
```

Expected JSON: `pendingApproval.tool === "notify_caretaker"`, preview/summary about missed medication, `lastBooking` null, no send. Use a unique session id.

If `until` is checkpoint, it must **not** auto-approve send.

- [ ] **Step 3: Full verification**

```sh
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "$(cat <<'EOF'
Document family email preview, Jules delivery, and the caretaker FAMILY UPDATE card.

Keep the canonical files in sync with notify_caretaker going through policy and Composio.
EOF
)"
```

---

## Spec coverage (self-review)

| Requirement | Task |
|---|---|
| Fix merge conflict | 1 |
| Jules is a family member | 2 |
| All mail to juleselvandrade@gmail.com | 2, 3 |
| Spoken “send an email to james alvarez saying …” | 4 |
| Senior MESSAGE TO card copy | 5 |
| Caretaker FAMILY UPDATE draft / sent / not sent | 6 |
| Senior Chat can send | 4, 5, 3 |
| Care-notes contact button can send | 7 |
| Human approval, no model self-approve | 3 (existing policy) |
| CI without Composio key | 3 |
| Canonical docs | 8 |
| Playground verification | 8 |
