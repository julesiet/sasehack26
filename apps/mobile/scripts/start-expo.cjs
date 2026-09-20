#!/usr/bin/env node
/**
 * Start Expo so Expo Go on a phone can scan the QR from a Mac or PC.
 * Uses the LAN IPv4 from apps/mobile/.env, or detects one, so the QR is
 * exp://<lan-ip>:8081 instead of localhost. Same host is used for
 * EXPO_PUBLIC_API_URL when that value is still loopback.
 */
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const { createRequire } = require("node:module");
const { networkInterfaces } = require("node:os");
const { resolve } = require("node:path");

const mobileRoot = resolve(__dirname, "..");
const requireFromMobile = createRequire(resolve(mobileRoot, "package.json"));

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

function portFromApiUrl(value) {
  const trimmed = value?.trim() ?? "";
  const urlPort = trimmed.match(/^https?:\/\/[^/]+:(\d+)/i);
  if (urlPort?.[1]) return urlPort[1];
  return "3001";
}

function isLoopback(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isIpv4(addr) {
  return addr.family === "IPv4" || addr.family === 4;
}

function detectLanHost() {
  const ipv4 = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.internal || !isIpv4(addr)) continue;
      if (addr.address.startsWith("169.254.")) continue;
      ipv4.push(addr.address);
    }
  }
  return (
    ipv4.find((ip) => ip.startsWith("192.168.")) ||
    ipv4.find((ip) => ip.startsWith("10.")) ||
    ipv4.find((ip) => /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) ||
    ipv4[0]
  );
}

loadEnvFile(resolve(mobileRoot, ".env"));
loadEnvFile(resolve(mobileRoot, ".env.local"));

const extra = process.argv.slice(2);

if (extra.includes("--ios") && process.platform === "win32") {
  console.error(
    "iOS Simulator needs a Mac. On Windows, run pnpm start and scan the QR in Expo Go on your phone.",
  );
  process.exit(1);
}

const wantsSimulator = extra.includes("--ios");
const wantsLocalhost = extra.includes("--localhost");
const hostFromUrl = hostFromApiUrl(process.env.EXPO_PUBLIC_API_URL ?? "");
const packagerHost = process.env.REACT_NATIVE_PACKAGER_HOSTNAME?.trim();
const configuredHost =
  (packagerHost && !isLoopback(packagerHost) && packagerHost) ||
  (hostFromUrl && !isLoopback(hostFromUrl) && hostFromUrl) ||
  undefined;

const lanHost =
  configuredHost ||
  (!(wantsSimulator || wantsLocalhost) ? detectLanHost() : undefined);

if (lanHost) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = lanHost;
  if (!hostFromUrl || isLoopback(hostFromUrl)) {
    process.env.EXPO_PUBLIC_API_URL = `http://${lanHost}:${portFromApiUrl(
      process.env.EXPO_PUBLIC_API_URL,
    )}`;
  }
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
  const source = configuredHost ? "from apps/mobile/.env" : "detected LAN";
  console.log(`Expo Go host ${lanHost} (${source})`);
  console.log(`API ${process.env.EXPO_PUBLIC_API_URL}`);
} else if (!wantsSimulator && !wantsLocalhost) {
  console.warn(
    "No LAN IPv4 found. Expo Go on a phone cannot use localhost. Set EXPO_PUBLIC_API_URL to this computer's Wi-Fi IP, or run pnpm start:tunnel.",
  );
}

const expoCli = requireFromMobile.resolve("expo/bin/cli");
const child = spawn(process.execPath, [expoCli, ...args], {
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
