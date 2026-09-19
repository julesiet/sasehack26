import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthSchema } from "@kasama/shared";
import { auditLog } from "./audit-log";
import { invokeTool } from "./invoke-tool";
import { sessionStore } from "./session-store";

export const app = new Hono();

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
