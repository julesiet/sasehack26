import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthSchema } from "@kasama/shared";

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

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Kasama API listening on http://localhost:${port}`);
});
