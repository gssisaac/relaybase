#!/usr/bin/env node
/**
 * Run a npm script in the sibling relaybase-worker repo.
 * Override with RELAYBASE_WORKER_DIR.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const workerDir = resolve(
  process.env.RELAYBASE_WORKER_DIR?.trim() ||
    join(repoRoot, "..", "relaybase-worker"),
);

const script = process.argv[2];
if (!script) {
  console.error("Usage: node scripts/run-worker.mjs <npm-script> [args…]");
  process.exit(1);
}

if (!existsSync(join(workerDir, "package.json"))) {
  console.error(
    `relaybase-worker not found at ${workerDir}.\n` +
      "Clone it as a sibling of this repo, or set RELAYBASE_WORKER_DIR.",
  );
  process.exit(1);
}

const extra = process.argv.slice(3);
const result = spawnSync(
  "npm",
  ["run", script, "--prefix", workerDir, ...extra],
  { stdio: "inherit" },
);
process.exit(result.status ?? 1);
