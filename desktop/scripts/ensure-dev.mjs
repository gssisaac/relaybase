#!/usr/bin/env node
/**
 * Tauri beforeDevCommand hook.
 *
 * Duck Launcher (and manual dev) often runs relaybase-app on :32830 already.
 * Starting a second `next dev` corrupts Turbopack's `.next` cache and causes
 * infinite reload loops in the Tauri webview. Wait briefly for an existing
 * server first; only spawn one when nothing is listening.
 */
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEV_PORT = 32830;
const DEV_HOST = "127.0.0.1";
/** Duck Launcher starts app + desktop together; allow a short race window. */
const PARALLEL_START_WAIT_MS = 12_000;
const POLL_MS = 200;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const desktopRoot = path.join(__dirname, "..");
const repoRoot = path.join(desktopRoot, "..");
const appRoot = path.join(repoRoot, "app");

function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function waitForDevServer(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await portOpen(DEV_HOST, DEV_PORT)) return true;
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  return false;
}

async function ensureDependencies() {
  const nextPkg = path.join(repoRoot, "node_modules", "next", "package.json");
  try {
    await fs.access(nextPkg);
    return;
  } catch {
    console.log("[relaybase-desktop] Workspace dependencies missing — installing…");
    const result = spawnSync("pnpm", ["install"], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }
  }
}

await ensureDependencies();

console.log(
  `[relaybase-desktop] Checking for Next.js dev server on http://${DEV_HOST}:${DEV_PORT}…`,
);
if (await waitForDevServer(PARALLEL_START_WAIT_MS)) {
  console.log(`[relaybase-desktop] Using existing dev server on :${DEV_PORT}`);
  process.exit(0);
}

console.log(`[relaybase-desktop] Starting Next.js on :${DEV_PORT}…`);
const result = spawnSync("pnpm", ["--dir", appRoot, "dev"], {
  cwd: desktopRoot,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
