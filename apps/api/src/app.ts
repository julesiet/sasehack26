import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthSchema } from "@kasama/shared";
import { auditLog } from "./audit-log";
import { runConversationTurn } from "./conversation";
import { invokeTool } from "./invoke-tool";
import { sessionStore } from "./session-store";
import { SttNotConfiguredError, transcriber, type Transcriber } from "./speech";

export type AppDeps = {
  transcribe: Transcriber;
};

export function createApp({ transcribe }: AppDeps = { transcribe: transcriber }): Hono {
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
      transcribe: "POST /speech/transcribe",
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

    const result = invokeTool(c.req.param("name"), raw);
    return c.json(result.body, result.status);
  });

  app.post("/conversation/turn", async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return c.json({ success: false, summary: "Request body must be JSON." }, 400);
    }

    const result = runConversationTurn(raw);
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

  return app;
}

export const app = createApp();
