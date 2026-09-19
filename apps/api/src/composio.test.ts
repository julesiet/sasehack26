import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPOSIO_CARETAKER_DRAFT_RECIPIENT,
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_DEFAULT_TOOLKIT,
  COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
  GMAIL_CARETAKER_DRAFT_ARGUMENTS,
} from "@kasama/shared";
import { ComposioNotConfiguredError, createKasamaComposio } from "./composio";

type ToolkitItem = {
  slug: string;
  connection?: { isActive?: boolean; connectedAccount?: { id: string } };
};

function fakeClient(options: {
  sessionId?: string;
  toolkits?: ToolkitItem[];
  authorize?: (toolkit: string) => Promise<{ redirectUrl: string; waitForConnection: () => Promise<{ id: string }> }>;
  execute?: (toolSlug: string, args?: Record<string, unknown>) => Promise<{
    data: Record<string, unknown>;
    error: string | null;
    logId: string;
  }>;
}) {
  const sessionId = options.sessionId ?? "sess_1";
  const authorize = options.authorize ?? (async (toolkit: string) => ({
    redirectUrl: `https://connect.composio.dev/link/ln_${toolkit}`,
    waitForConnection: async () => ({ id: "ca_1" }),
  }));
  const execute = options.execute ?? (async () => ({
    data: { emailAddress: "maria@example.com", messagesTotal: 3 },
    error: null,
    logId: "log_abc",
  }));

  const session = {
    sessionId,
    authorize,
    toolkits: async () => ({ items: options.toolkits ?? [] }),
    execute,
  };

  const createdFor: string[] = [];
  const resumed: string[] = [];
  return {
    createdFor,
    resumed,
    session,
    create: async (userId: string) => {
      createdFor.push(userId);
      return session;
    },
    use: async (id: string) => {
      resumed.push(id);
      return session;
    },
  };
}

let fake: ReturnType<typeof fakeClient>;

beforeEach(() => {
  fake = fakeClient({
    toolkits: [{ slug: "gmail", connection: { isActive: false } }],
  });
});

describe("createKasamaComposio", () => {
  it("throws ComposioNotConfiguredError when the project key is missing", async () => {
    const composio = createKasamaComposio({ readApiKey: () => undefined });
    await expect(composio.connect()).rejects.toBeInstanceOf(ComposioNotConfiguredError);
  });

  it("creates one session per user and resumes it on the next call", async () => {
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: true } }],
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    const first = await composio.connect();
    const second = await composio.connect();

    expect(first.userId).toBe("senior_maria");
    expect(first.sessionId).toBe("sess_1");
    expect(first.connected).toBe(true);
    expect(first.toolkit).toBe(COMPOSIO_DEFAULT_TOOLKIT);
    expect(client.createdFor).toEqual(["senior_maria"]);
    expect(client.resumed).toEqual(["sess_1"]);
    expect(second.sessionId).toBe(first.sessionId);
  });

  it("returns a Connect Link when Gmail is not connected", async () => {
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => fake,
    });

    const result = await composio.connect();
    expect(result.connected).toBe(false);
    expect(result.redirectUrl).toBe("https://connect.composio.dev/link/ln_gmail");
  });

  it("executes GMAIL_GET_PROFILE on the persisted session and returns the log id", async () => {
    const execute = vi.fn(async (toolSlug: string, args?: Record<string, unknown>) => {
      expect(toolSlug).toBe(COMPOSIO_DEFAULT_TOOL);
      expect(args).toEqual({ user_id: "me" });
      return {
        data: { emailAddress: "maria@example.com", messagesTotal: 3 },
        error: null,
        logId: "log_abc",
      };
    });
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: true } }],
      execute,
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    await composio.connect();
    const result = await composio.execute();

    expect(result.successful).toBe(true);
    expect(result.toolSlug).toBe(COMPOSIO_DEFAULT_TOOL);
    expect(result.logId).toBe("log_abc");
    expect(result.data).toEqual({ emailAddress: "maria@example.com", messagesTotal: 3 });
    expect(client.createdFor).toHaveLength(1);
  });

  it("returns needsAuth instead of executing when Gmail is not connected", async () => {
    const execute = vi.fn();
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: false } }],
      execute,
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    const result = await composio.execute();
    expect(result.successful).toBe(false);
    expect(result.needsAuth).toBe(true);
    expect(result.redirectUrl).toMatch(/^https:\/\/connect\.composio\.dev\//);
    expect(execute).not.toHaveBeenCalled();
  });

  it("creates a Gmail draft for senior_maria with caretaker arguments", async () => {
    const execute = vi.fn(async (toolSlug: string, args?: Record<string, unknown>) => {
      expect(toolSlug).toBe(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL);
      expect(args).toEqual(GMAIL_CARETAKER_DRAFT_ARGUMENTS);
      return {
        data: { draft_id: "r-draft-1", id: "r-draft-1" },
        error: null,
        logId: "log_draft",
      };
    });
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: true } }],
      execute,
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    const result = await composio.execute({
      toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
    });

    expect(result.successful).toBe(true);
    expect(result.userId).toBe("senior_maria");
    expect(result.toolSlug).toBe(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL);
    expect(result.logId).toBe("log_draft");
    expect(result.data).toEqual({ draft_id: "r-draft-1", id: "r-draft-1" });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("lets the caller override draft subject and body without changing recipient", async () => {
    const execute = vi.fn(async (_toolSlug: string, args?: Record<string, unknown>) => {
      expect(args).toMatchObject({
        user_id: "me",
        recipient_email: COMPOSIO_CARETAKER_DRAFT_RECIPIENT,
        subject: "Ride booked",
        body: "Maria's WAV is confirmed.",
      });
      return {
        data: { draft_id: "r-draft-2" },
        error: null,
        logId: "log_draft_2",
      };
    });
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: true } }],
      execute,
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    const result = await composio.execute({
      toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
      arguments: {
        subject: "Ride booked",
        body: "Maria's WAV is confirmed.",
      },
    });

    expect(result.successful).toBe(true);
    expect(result.logId).toBe("log_draft_2");
  });

  it("returns a Connect Link instead of drafting when Gmail is not connected", async () => {
    const execute = vi.fn();
    const client = fakeClient({
      toolkits: [{ slug: "gmail", connection: { isActive: false } }],
      execute,
    });
    const composio = createKasamaComposio({
      readApiKey: () => "ak_test",
      getClient: () => client,
    });

    const result = await composio.execute({
      toolSlug: COMPOSIO_GMAIL_CREATE_DRAFT_TOOL,
    });
    expect(result.successful).toBe(false);
    expect(result.needsAuth).toBe(true);
    expect(result.toolSlug).toBe(COMPOSIO_GMAIL_CREATE_DRAFT_TOOL);
    expect(result.redirectUrl).toMatch(/^https:\/\/connect\.composio\.dev\//);
    expect(execute).not.toHaveBeenCalled();
  });
});
