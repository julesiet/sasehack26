import { Composio } from "@composio/core";
import {
  COMPOSIO_DEFAULT_TOOL,
  COMPOSIO_DEFAULT_TOOLKIT,
  MARIA_PROFILE,
  resolveComposioExecuteArguments,
  type ComposioConnectRequest,
  type ComposioConnectResponse,
  type ComposioExecuteRequest,
  type ComposioExecuteResponse,
} from "@kasama/shared";

export class ComposioNotConfiguredError extends Error {
  constructor() {
    super("COMPOSIO_API_KEY is not configured.");
    this.name = "ComposioNotConfiguredError";
  }
}

export type ComposioSessionLike = {
  sessionId: string;
  authorize: (toolkit: string) => Promise<{
    redirectUrl?: string | null;
    waitForConnection: (timeout?: number) => Promise<unknown>;
  }>;
  toolkits: () => Promise<{
    items: Array<{
      slug: string;
      connection?: {
        isActive?: boolean;
        connectedAccount?: { id?: string };
      };
    }>;
  }>;
  execute: (
    toolSlug: string,
    arguments_?: Record<string, unknown>,
  ) => Promise<{
    data: Record<string, unknown>;
    error: string | null;
    logId: string;
  }>;
};

export type ComposioClientLike = {
  create: (userId: string) => Promise<ComposioSessionLike>;
  use: (sessionId: string) => Promise<ComposioSessionLike>;
};

export type KasamaComposio = {
  connect: (input?: ComposioConnectRequest) => Promise<ComposioConnectResponse>;
  execute: (input?: ComposioExecuteRequest) => Promise<ComposioExecuteResponse>;
};

function defaultReadApiKey(): string | undefined {
  const key = process.env.COMPOSIO_API_KEY?.trim();
  return key || undefined;
}

function toolkitConnected(
  items: Awaited<ReturnType<ComposioSessionLike["toolkits"]>>["items"],
  toolkit: string,
): boolean {
  const match = items.find((item) => item.slug === toolkit);
  return Boolean(match?.connection?.isActive || match?.connection?.connectedAccount?.id);
}

/**
 * One Composio session per Kasama user. Identity is `MARIA_PROFILE.id`
 * (`senior_maria`) unless the caller passes another `userId`.
 */
export function createKasamaComposio(
  deps: {
    readApiKey?: () => string | undefined;
    getClient?: () => ComposioClientLike;
  } = {},
): KasamaComposio {
  const readApiKey = deps.readApiKey ?? defaultReadApiKey;
  const sessionIds = new Map<string, string>();
  let client: ComposioClientLike | undefined;

  function requireClient(): ComposioClientLike {
    if (!readApiKey()) {
      throw new ComposioNotConfiguredError();
    }
    if (!client) {
      client = deps.getClient?.() ?? (new Composio() as unknown as ComposioClientLike);
    }
    return client;
  }

  async function sessionFor(userId: string): Promise<ComposioSessionLike> {
    const composio = requireClient();
    const existing = sessionIds.get(userId);
    if (existing) {
      return composio.use(existing);
    }
    const session = await composio.create(userId);
    sessionIds.set(userId, session.sessionId);
    return session;
  }

  return {
    async connect(input: ComposioConnectRequest = {}): Promise<ComposioConnectResponse> {
      const userId = input.userId ?? MARIA_PROFILE.id;
      const toolkit = input.toolkit ?? COMPOSIO_DEFAULT_TOOLKIT;
      const session = await sessionFor(userId);
      const { items } = await session.toolkits();
      if (toolkitConnected(items, toolkit)) {
        return { userId, sessionId: session.sessionId, toolkit, connected: true };
      }

      const request = await session.authorize(toolkit);
      if (input.wait) {
        await request.waitForConnection(180_000);
        return { userId, sessionId: session.sessionId, toolkit, connected: true };
      }

      return {
        userId,
        sessionId: session.sessionId,
        toolkit,
        connected: false,
        ...(request.redirectUrl ? { redirectUrl: request.redirectUrl } : {}),
      };
    },

    async execute(input: ComposioExecuteRequest = {}): Promise<ComposioExecuteResponse> {
      const userId = input.userId ?? MARIA_PROFILE.id;
      const toolSlug = input.toolSlug ?? COMPOSIO_DEFAULT_TOOL;
      const toolkit = COMPOSIO_DEFAULT_TOOLKIT;
      const session = await sessionFor(userId);
      const { items } = await session.toolkits();
      if (!toolkitConnected(items, toolkit)) {
        const request = await session.authorize(toolkit);
        return {
          userId,
          sessionId: session.sessionId,
          toolSlug,
          successful: false,
          needsAuth: true,
          toolkit,
          ...(request.redirectUrl ? { redirectUrl: request.redirectUrl } : {}),
        };
      }

      const result = await session.execute(
        toolSlug,
        resolveComposioExecuteArguments(toolSlug, input.arguments),
      );
      return {
        userId,
        sessionId: session.sessionId,
        toolSlug,
        successful: !result.error,
        data: result.data,
        ...(result.logId ? { logId: result.logId } : {}),
        ...(result.error ? { error: result.error } : {}),
      };
    },
  };
}

export const kasamaComposio = createKasamaComposio();
