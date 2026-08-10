#!/usr/bin/env node
/**
 * Produce a static export suitable for Tauri (`app/out`).
 * Temporarily moves Route Handlers aside — Next `output: "export"` cannot
 * coexist with `app/api/**`. Restores them after the build.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.join(__dirname, "..");
const apiDir = path.join(appRoot, "src", "app", "api");
const stashDir = path.join(appRoot, ".desktop-stash", "api");
const catchAll = path.join(
  appRoot,
  "src",
  "app",
  "(dashboard)",
  "[...path]",
  "page.tsx",
);

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
let catchAllBackup = null;

try {
  // Only local-credentials remains under api/ — stash for static export.
  if (fs.existsSync(apiDir)) {
    fs.mkdirSync(path.dirname(stashDir), { recursive: true });
    if (fs.existsSync(stashDir)) {
      fs.rmSync(stashDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, stashDir);
    stashed = true;
    console.log("→ Stashed app/src/app/api for static export");
  }

  if (fs.existsSync(catchAll)) {
    catchAllBackup = fs.readFileSync(catchAll, "utf8");
    const staticParams = `export function generateStaticParams() {
  return [
    { path: ["dashboard"] },
    { path: ["domains"] },
    { path: ["accounts"] },
    { path: ["keys"] },
    { path: ["audience"] },
    { path: ["broadcasts"] },
    { path: ["settings"] },
    { path: ["email"] },
    { path: ["email", "inbox"] },
    { path: ["email", "drafts"] },
    { path: ["email", "sent"] },
    { path: ["email", "compose"] },
    { path: ["email", "trash"] },
  ];
}

`;
    const patched = catchAllBackup
      .replace(/export const dynamic = "force-dynamic";\n*/, "")
      .replace(/type Props/, `${staticParams}type Props`);
    fs.writeFileSync(catchAll, patched);
  }

  run("pnpm", ["exec", "next", "build"], { DESKTOP_BUILD: "1" });

  console.log("✓ Desktop static export ready at app/out");
} finally {
  if (catchAllBackup !== null) {
    fs.writeFileSync(catchAll, catchAllBackup);
  }
  if (stashed && fs.existsSync(stashDir)) {
    if (fs.existsSync(apiDir)) {
      fs.rmSync(apiDir, { recursive: true, force: true });
    }
    fs.renameSync(stashDir, apiDir);
    console.log("→ Restored app/src/app/api");
  }
}
