#!/usr/bin/env node
/**
 * Deploy hq/studio Node server to Railway (Docker build uses monorepo root).
 * Must run with cwd = repository root so the upload includes pnpm-lock, patches/, etc.
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const RAILWAY_SERVICE = "hq-relaybase-studio-dbver";

const result = spawnSync(
  "pnpm",
  ["dlx", "@railway/cli", "up", "--service", RAILWAY_SERVICE, "-y", "-d"],
  { cwd: repoRoot, stdio: "inherit", env: process.env },
);

process.exit(result.status ?? 1);
