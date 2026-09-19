#!/usr/bin/env node
/**
 * Production deploy: relaybase.email (Cloudflare) + Studio API (Railway), in parallel.
 */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const appDir = join(repoRoot, "app");

function runJob(label, command, args, cwd) {
  return new Promise((resolve) => {
    console.log(`[deploy:${label}] starting (${cwd})`);
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => {
      const exitCode = code ?? 1;
      if (exitCode === 0) {
        console.log(`[deploy:${label}] done`);
      } else {
        console.error(`[deploy:${label}] failed (exit ${exitCode})`);
      }
      resolve({ label, exitCode });
    });
    child.on("error", (err) => {
      console.error(`[deploy:${label}] error:`, err.message);
      resolve({ label, exitCode: 1 });
    });
  });
}

const jobs = await Promise.all([
  runJob("web", "pnpm", ["run", "deploy:web"], appDir),
  runJob(
    "studio",
    process.execPath,
    [join(repoRoot, "scripts/deploy-studio-railway.mjs")],
    repoRoot,
  ),
]);

const failed = jobs.filter((j) => j.exitCode !== 0);
if (failed.length > 0) {
  console.error(
    "\nProduction deploy failed:",
    failed.map((j) => j.label).join(", "),
  );
  process.exit(1);
}

console.log("\nProduction deploy finished (web + studio).");
