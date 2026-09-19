import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load `apps/api/.env` even when turbo/tsx was started from the repo root.
 * Does not overwrite variables already in the process environment.
 */
const envPath = resolve(dirname(fileURLToPath(import.meta.url)), "../.env");

try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
} catch {
  // No local .env is fine; keys can still come from the shell.
}
