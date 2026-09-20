import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  composioConnectRequestSchema,
  composioExecuteRequestSchema,
  healthSchema,
  speakRequestSchema,
} from "@kasama/shared";
import { auditLog } from "./audit-log";
import { ComposioNotConfiguredError, kasamaComposio, type KasamaComposio } from "./composio";
import { decideApproval } from "./approval";
import { runConversationChat, runConversationTurn } from "./conversation";
import { invokeTool } from "./invoke-tool";
import { runPlaygroundTurn } from "./playground";
import type { ChatComplete } from "./model";
import { sessionStore } from "./session-store";
import {
  SttNotConfiguredError,
  TtsNotConfiguredError,
  speaker,
  transcriber,
  type Speaker,
  type Transcriber,
} from "./speech";

export type AppDeps = {
  transcribe: Transcriber;
  speak?: Speaker;
  composio?: KasamaComposio;
  complete?: ChatComplete;
};

export function createApp({
  transcribe,
  speak = speaker,
  composio = kasamaComposio,
  complete,
}: AppDeps = { transcribe: transcriber, speak: speaker }): Hono {
  const app = new Hono();

  app.use(
    "*",
    cors({
      origin: "*",
    }),
  );

  app.get("/", (c) => {
    return c.json({
      service: "kasama-api",
      health: "/health",
      tools: "POST /tools/:name",
      sessions: "GET /sessions/:sessionId",
      audit: "GET /audit",
      conversation: "POST /conversation/turn",
      conversationChats: "POST /conversation/chats",
      playground: "POST /playground",
      approvals: "POST /approvals",
      transcribe: "POST /speech/transcribe",
      speak: "POST /speech/speak",
      composioConnect: "POST /composio/connect",
      composioExecute: "POST /composio/execute",
      hint: "This is the API. The app runs in the iOS Simulator via pnpm ios.",
    });
  });

  app.get("/health", (c) => {
    const body = healthSchema.parse({
      ok: true,
      service: "kasama-api",
    });
    return c.json(body);
  });

  app.get("/audit", (c) => {
    const sessionId = c.req.query("sessionId");
    const events = auditLog.list();
    if (!sessionId) {
      return c.json({ events });
    }
    return c.json({
      events: events.filter((event) => event.whoAsked.sessionId === sessionId),
    });
  });

  app.get("/sessions/:sessionId", (c) => {
    return c.json(sessionStore.get(c.req.param("sessionId")));
  });

  app.post("/tools/:name", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = await invokeTool(c.req.param("name"), raw);
    return c.json(result.body, result.status);
  });

  app.post("/approvals", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = await decideApproval(raw);
    return c.json(result.body, result.status);
  });

  app.post("/conversation/turn", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = await runConversationTurn(raw, complete ? { complete } : {});
    return c.json(result.body, result.status);
  });

  app.post("/conversation/chats", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = runConversationChat(raw);
    return c.json(result.body, result.status);
  });

  /**
   * Text playground (#13). Same harness + policy as conversation/turn, plus
   * appointment, ride options, audit events, and the pending checkpoint.
   */
  app.post("/playground", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = await runPlaygroundTurn(raw, complete ? { complete } : {});
    return c.json(result.body, result.status);
  });

  /** Multipart upload with a `file` field (m4a/wav). Returns `{ transcript }`. */
  app.post("/speech/transcribe", async (c) => {
    let file: unknown;
    try {
      const body = await c.req.parseBody();
      file = body.file;
    } catch {
      return c.json(
        { error: "bad_request", summary: "Send multipart form data with a `file` field." },
        400,
      );
    }

    if (!(file instanceof Blob)) {
      return c.json({ error: "bad_request", summary: "Missing audio `file` field." }, 400);
    }

    const filename = file instanceof File && file.name ? file.name : "speech.m4a";

    try {
      const transcript = await transcribe(file, filename);
      return c.json({ transcript });
    } catch (error) {
      if (error instanceof SttNotConfiguredError) {
        return c.json(
          {
            error: "stt_not_configured",
            summary:
              "Speech-to-text is not configured on this API. Set ELEVENLABS_API_KEY or type your request.",
          },
          501,
        );
      }
      const summary = error instanceof Error ? error.message : "Transcription failed.";
      return c.json({ error: "transcription_failed", summary }, 502);
    }
  });

  /** `{ text }` → MPEG audio of Kasama speaking. Falls back to iOS speech on the device if 501. */
  app.post("/speech/speak", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ error: "bad_request", summary: "Request body must be JSON." }, 400);
    }

    const request = speakRequestSchema.safeParse(raw);
    if (!request.success) {
      return c.json({ error: "bad_request", summary: "Reply text is required." }, 400);
    }

    try {
      const spoken = await speak(request.data.text);
      return c.body(Buffer.from(spoken.bytes), 200, { "Content-Type": spoken.contentType });
    } catch (error) {
      if (error instanceof TtsNotConfiguredError) {
        return c.json(
          {
            error: "tts_not_configured",
            summary: "Kasama's ElevenLabs voice is not configured. Set ELEVENLABS_API_KEY.",
          },
          501,
        );
      }
      const summary = error instanceof Error ? error.message : "Speech failed.";
      return c.json({ error: "tts_failed", summary }, 502);
    }
  });

  /** Start or resume a Composio session and return a Gmail Connect Link if needed. */
  app.post("/composio/connect", async (c) => {
    let raw: unknown = {};
    try {
      raw = await c.req.json();
    } catch {
      raw = {};
    }

    const request = composioConnectRequestSchema.safeParse(raw);
    if (!request.success) {
      return c.json({ error: "bad_request", summary: "Invalid connect body." }, 400);
    }

    try {
      return c.json(await composio.connect(request.data));
    } catch (error) {
      if (error instanceof ComposioNotConfiguredError) {
        return c.json(
          {
            error: "composio_not_configured",
            summary: "Composio is not configured. Set COMPOSIO_API_KEY in apps/api/.env.",
          },
          501,
        );
      }
      const summary = error instanceof Error ? error.message : "Connect failed.";
      return c.json({ error: "composio_failed", summary }, 502);
    }
  });

  /** Execute a session tool. Defaults to GMAIL_GET_PROFILE; draft or send when asked. */
  app.post("/composio/execute", async (c) => {
    let raw: unknown = {};
    try {
      raw = await c.req.json();
    } catch {
      raw = {};
    }

    const request = composioExecuteRequestSchema.safeParse(raw);
    if (!request.success) {
      return c.json({ error: "bad_request", summary: "Invalid execute body." }, 400);
    }

    try {
      const body = await composio.execute(request.data);
      return c.json(body, body.needsAuth ? 409 : 200);
    } catch (error) {
      if (error instanceof ComposioNotConfiguredError) {
        return c.json(
          {
            error: "composio_not_configured",
            summary: "Composio is not configured. Set COMPOSIO_API_KEY in apps/api/.env.",
          },
          501,
        );
      }
      const summary = error instanceof Error ? error.message : "Execute failed.";
      return c.json({ error: "composio_failed", summary }, 502);
    }
  });

  return app;
}

export const app = createApp();
