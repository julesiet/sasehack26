import { describe, expect, it } from "vitest";
import {
  COMPOSIO_CARETAKER_RECIPIENT,
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_DEFAULT_TOOLKIT,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
  COMPOSIO_GMAIL_SEND_TOOL,
  GMAIL_CARETAKER_DRAFT_ARGUMENTS,
  GMAIL_CARETAKER_SEND_ARGUMENTS,
  composioConnectRequestSchema,
  composioConnectResponseSchema,
  composioExecuteRequestSchema,
  composioExecuteResponseSchema,
  normalizeComposioExecuteData,
  resolveComposioExecuteArguments,
} from "./composio";

describe("composio contract", () => {
  it("defaults the first integration to documented Gmail profile read", () => {
    expect(COMPOSIO_DEFAULT_TOOLKIT).toBe("gmail");
    expect(COMPOSIO_DEFAULT_TOOL).toBe("GMAIL_GET_PROFILE");
  });

  it("exposes documented Gmail draft and send slugs without changing the default", () => {
    expect(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL).toBe("GMAIL_CREATE_EMAIL_DRAFT");
    expect(COMPOSIO_GMAIL_SEND_TOOL).toBe("GMAIL_SEND_EMAIL");
    expect(COMPOSIO_CARETAKER_RECIPIENT).toBe("juleselvandrade@gmail.com");
  });

  it("allows an empty connect body and a Connect Link response", () => {
    expect(composioConnectRequestSchema.parse({})).toEqual({});
    const parsed = composioConnectResponseSchema.parse({
      userId: "senior_maria",
      sessionId: "sess_1",
      toolkit: "gmail",
      connected: false,
      redirectUrl: "https://connect.composio.dev/link/ln_test",
    });
    expect(parsed.connected).toBe(false);
  });

  it("accepts a profile execute result with a log id", () => {
    expect(composioExecuteRequestSchema.parse({})).toEqual({});
    const parsed = composioExecuteResponseSchema.parse({
      userId: "senior_maria",
      sessionId: "sess_1",
      toolSlug: "GMAIL_GET_PROFILE",
      successful: true,
      data: { emailAddress: "maria@example.com" },
      logId: "log_abc",
    });
    expect(parsed.logId).toBe("log_abc");
  });

  it("accepts draft and send slugs and rejects GMAIL_SEND_DRAFT", () => {
    expect(
      composioExecuteRequestSchema.parse({
        toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
      }).toolSlug,
    ).toBe("GMAIL_CREATE_EMAIL_DRAFT");
    expect(
      composioExecuteRequestSchema.parse({
        toolSlug: COMPOSIO_GMAIL_SEND_TOOL,
      }).toolSlug,
    ).toBe("GMAIL_SEND_EMAIL");
    expect(
      composioExecuteRequestSchema.safeParse({ toolSlug: "GMAIL_SEND_DRAFT" }).success,
    ).toBe(false);
  });

  it("fills caretaker draft and send arguments and keeps caller overrides", () => {
    expect(resolveComposioExecuteArguments(COMPOSIO_DEFAULT_TOOL)).toEqual({
      user_id: "me",
    });
    expect(resolveComposioExecuteArguments(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL)).toEqual(
      GMAIL_CARETAKER_DRAFT_ARGUMENTS,
    );
    expect(resolveComposioExecuteArguments(COMPOSIO_GMAIL_SEND_TOOL)).toEqual(
      GMAIL_CARETAKER_SEND_ARGUMENTS,
    );
    expect(
      resolveComposioExecuteArguments(COMPOSIO_GMAIL_SEND_TOOL, {
        subject: "Ride booked",
        body: "Maria's WAV is confirmed.",
      }),
    ).toMatchObject({
      user_id: "me",
      recipient_email: COMPOSIO_CARETAKER_RECIPIENT,
      subject: "Ride booked",
      body: "Maria's WAV is confirmed.",
    });
  });

  it("copies Composio's Gmail draft id onto draft_id without changing other tools", () => {
    expect(
      normalizeComposioExecuteData(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL, {
        id: "r-draft-live",
        display_url: "https://mail.google.com/mail/u/0/#drafts",
        message: { id: "msg_1" },
      }),
    ).toMatchObject({
      id: "r-draft-live",
      draft_id: "r-draft-live",
      display_url: "https://mail.google.com/mail/u/0/#drafts",
    });
    expect(
      normalizeComposioExecuteData(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL, {
        draft_id: "r-already",
        id: "r-already",
      }),
    ).toMatchObject({ draft_id: "r-already" });
    expect(
      normalizeComposioExecuteData(COMPOSIO_DEFAULT_TOOL, {
        emailAddress: "maria@example.com",
        id: "not-a-draft",
      }),
    ).toEqual({
      emailAddress: "maria@example.com",
      id: "not-a-draft",
    });
  });
});
