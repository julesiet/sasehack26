import "./load-env";
import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT ?? 3001);

serve({ fetch: app.fetch, port }, () => {
  console.log(`Kasama API listening on http://localhost:${port}`);
});
