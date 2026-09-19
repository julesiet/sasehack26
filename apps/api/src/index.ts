import "./load-env";
import { networkInterfaces } from "node:os";
import { serve } from "@hono/node-server";
import { app } from "./app";

const port = Number(process.env.PORT ?? 3001);

function lanUrls(): string[] {
  const urls: string[] = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal || addr.family !== "IPv4") continue;
      urls.push(`http://${addr.address}:${port}`);
    }
  }
  return urls;
}

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`Kasama API listening on http://localhost:${port}`);
  for (const url of lanUrls()) {
    console.log(`Kasama API on LAN ${url}`);
  }
});
