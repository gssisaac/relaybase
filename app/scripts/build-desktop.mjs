#!/usr/bin/env node
/**
 * Produce a static export suitable for Tauri (`app/out`).
 * Temporarily moves Route Handlers aside — Next `output: "export"` cannot
 * coexist with `app/api/**`. Also stashes the dev-only legacy catch-all
 * (`(shell)/[...path]`) so the static build only emits real section routes.
 * Restores everything after the build.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const apiDir = path.join(appRoot, "src", "app", "api");
const stashDir = path.join(appRoot, ".desktop-stash", "api");
const catchAllDir = path.join(
  appRoot,
  "src",
  "app",
  "(shell)",
  "[...path]",
);
const catchAllStash = path.join(appRoot, ".desktop-stash", "[...path]");

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function moveDir(src, dest) {
  // renameSync can fail with EXDEV across filesystems (e.g. overlay mounts).
  // Fall back to copy + recursive remove.
  try {
    fs.renameSync(src, dest);
  } catch (err) {
    if (err && err.code === "EXDEV") {
      copyDir(src, dest);
      fs.rmSync(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

function run(cmd, args, env = {}) {
  const result = spawnSync(cmd, args, {
    cwd: appRoot,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(" ")}`);
  }
}

let stashed = false;
let catchAllStashed = false;

try {
  // Only local-credentials remains under api/ — stash for static export.
  if (fs.existsSync(apiDir)) {
    fs.mkdirSync(path.dirname(stashDir), { recursive: true });
    if (fs.existsSync(stashDir)) {
      fs.rmSync(stashDir, { recursive: true, force: true });
    }
    moveDir(apiDir, stashDir);
    stashed = true;
    console.log("→ Stashed app/src/app/api for static export");
  }

  // The dev-only legacy catch-all rewrites deep path segments into query
  // params. Static export must not emit it (it would shadow real routes),
  // so stash the folder for the duration of the build.
  if (fs.existsSync(catchAllDir)) {
    fs.mkdirSync(path.dirname(catchAllStash), { recursive: true });
    if (fs.existsSync(catchAllStash)) {
      fs.rmSync(catchAllStash, { recursive: true, force: true });
    }
    moveDir(catchAllDir, catchAllStash);
    catchAllStashed = true;
    console.log("→ Stashed (shell)/[...path] catch-all for static export");
  }

  run("pnpm", ["exec", "next", "build"], { DESKTOP_BUILD: "1" });

  console.log("✓ Desktop static export ready at app/out");
} finally {
  if (catchAllStashed && fs.existsSync(catchAllStash)) {
    if (fs.existsSync(catchAllDir)) {
      fs.rmSync(catchAllDir, { recursive: true, force: true });
    }
    moveDir(catchAllStash, catchAllDir);
    console.log("→ Restored (shell)/[...path] catch-all");
  }
  if (stashed && fs.existsSync(stashDir)) {
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    moveDir(stashDir, apiDir);
    console.log("→ Restored app/src/app/api");
  }
}
