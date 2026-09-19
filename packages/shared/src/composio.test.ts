import { describe, expect, it } from "vitest";
import {
  COMPOSIO_CARETAKER_DRAFT_RECIPIENT,
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_DEFAULT_TOOLKIT,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
  GMAIL_CARETAKER_DRAFT_ARGUMENTS,
  composioConnectRequestSchema,
  composioConnectResponseSchema,
  composioExecuteRequestSchema,
  composioExecuteResponseSchema,
  resolveComposioExecuteArguments,
} from "./composio";

describe("composio contract", () => {
  it("defaults the first integration to documented Gmail profile read", () => {
    expect(COMPOSIO_DEFAULT_TOOLKIT).toBe("gmail");
    expect(COMPOSIO_DEFAULT_TOOL).toBe("GMAIL_GET_PROFILE");
  });

  it("exposes the documented Gmail create-draft slug without changing the default", () => {
    expect(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL).toBe("GMAIL_CREATE_EMAIL_DRAFT");
    expect(COMPOSIO_CARETAKER_DRAFT_RECIPIENT).toMatch(/@example\.com$/);
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

  it("accepts the create-draft slug and rejects send slugs", () => {
    expect(
      composioExecuteRequestSchema.parse({
        toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
      }).toolSlug,
    ).toBe("GMAIL_CREATE_EMAIL_DRAFT");
    expect(
      composioExecuteRequestSchema.safeParse({ toolSlug: "GMAIL_SEND_EMAIL" }).success,
    ).toBe(false);
    expect(
      composioExecuteRequestSchema.safeParse({ toolSlug: "GMAIL_SEND_DRAFT" }).success,
    ).toBe(false);
  });

  it("fills caretaker draft arguments and keeps caller overrides", () => {
    expect(resolveComposioExecuteArguments(COMPOSIO_DEFAULT_TOOL)).toEqual({
      user_id: "me",
    });
    expect(resolveComposioExecuteArguments(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL)).toEqual(
      GMAIL_CARETAKER_DRAFT_ARGUMENTS,
    );
    expect(
      resolveComposioExecuteArguments(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL, {
        subject: "Ride booked",
        body: "Maria's WAV is confirmed.",
      }),
    ).toMatchObject({
      user_id: "me",
      recipient_email: COMPOSIO_CARETAKER_DRAFT_RECIPIENT,
      subject: "Ride booked",
      body: "Maria's WAV is confirmed.",
    });
  });
});
