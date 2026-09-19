#!/usr/bin/env node
/**
 * Start Expo on the LAN host from apps/mobile/.env so Expo Go on a
 * phone gets exp://<mac-ip>:8081 instead of localhost.
 * EXPO_PUBLIC_API_URL=http://192.168.x.x:3001 (or REACT_NATIVE_PACKAGER_HOSTNAME).
 */
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const mobileRoot = resolve(__dirname, "..");

function loadEnvFile(file) {
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional
  }
}

function hostFromApiUrl(value) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return undefined;
  const urlMatch = trimmed.match(/^https?:\/\/\[?([^\]/?#:]+)\]?/i);
  if (urlMatch?.[1]) return urlMatch[1];
  const bare = trimmed.match(/^\[?([^\]/:]+)\]?(?::\d+)?$/);
  return bare?.[1];
}

function isLoopback(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

loadEnvFile(resolve(mobileRoot, ".env"));
loadEnvFile(resolve(mobileRoot, ".env.local"));

const extra = process.argv.slice(2);
const hostFromUrl = hostFromApiUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
const packagerHost = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim();
const lanHost =
  (packagerHost && !isLoopback(packagerHost) && packagerHost) ||
  (hostFromUrl && !isLoopback(hostFromUrl) && hostFromUrl) ||
  undefined;

if (lanHost) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanHost;
}

const userSetHost = extra.some(
  (arg) =>
    arg === "--lan" ||
    arg === "--tunnel" ||
    arg === "--localhost" ||
    arg === "--host" ||
    arg.startsWith("--host="),
);

const args = ["start", ...extra];
if (!userSetHost && lanHost) {
  args.push("--host", "lan");
}

if (lanHost) {
  console.log(`Expo Go host ${lanHost} (from apps/mobile/.env)`);
}

const expoBin = resolve(mobileRoot, "node_modules/.bin/expo");
const child = spawn(expoBin, args, {
  cwd: mobileRoot,
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
