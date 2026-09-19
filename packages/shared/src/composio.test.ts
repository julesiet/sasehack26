import { describe, expect, it } from "vitest";
import {
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_DEFAULT_TOOLKIT,
  composioConnectRequestSchema,
  composioConnectResponseSchema,
  composioExecuteRequestSchema,
  composioExecuteResponseSchema,
} from "./composio";

describe("composio contract", () => {
  it("defaults the first integration to documented Gmail profile read", () => {
    expect(COMPOSIO_DEFAULT_TOOLKIT).toBe("gmail");
    expect(COMPOSIO_DEFAULT_TOOL).toBe("GMAIL_GET_PROFILE");
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
});
