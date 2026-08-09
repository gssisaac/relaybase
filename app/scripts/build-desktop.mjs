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
const catchAll = path.join(appRoot, "src", "app", "(dashboard)", "[...path]", "page.tsx");

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
  if (fs.existsSync(apiDir)) {
    fs.mkdirSync(path.dirname(stashDir), { recursive: true });
    if (fs.existsSync(stashDir)) {
      fs.rmSync(stashDir, { recursive: true, force: true });
    }
    fs.renameSync(apiDir, stashDir);
    stashed = true;
    console.log("→ Stashed app/src/app/api for static export");
  }

  // Remove force-dynamic for export
  if (fs.existsSync(catchAll)) {
    catchAllBackup = fs.readFileSync(catchAll, "utf8");
    const patched = catchAllBackup
      .replace(/export const dynamic = "force-dynamic";\n*/, "")
      .replace(
        /type Props/,
        `export function generateStaticParams() {\n  return [{ path: ["dashboard"] }];\n}\n\ntype Props`,
      );
    fs.writeFileSync(catchAll, patched);
  }

  // Soften login/root pages that use cookies for export. Home restores the
  // last email/dashboard route from localStorage (same as browser entry).
  const rootPage = path.join(appRoot, "src", "app", "page.tsx");
  let rootBackup = null;
  if (fs.existsSync(rootPage)) {
    rootBackup = fs.readFileSync(rootPage, "utf8");
    fs.writeFileSync(
      rootPage,
      `"use client";\nimport { RestoreLastRoute } from "@/components/RestoreLastRoute";\nexport default function Home() {\n  return <RestoreLastRoute fallbackUserId="desktop" />;\n}\n`,
    );
  }

  const loginPage = path.join(appRoot, "src", "app", "login", "page.tsx");
  let loginBackup = null;
  if (fs.existsSync(loginPage)) {
    loginBackup = fs.readFileSync(loginPage, "utf8");
    fs.writeFileSync(
      loginPage,
      `"use client";\nexport default function LoginPage() {\n  return <p className="p-8 text-sm">Use the desktop onboarding flow.</p>;\n}\n`,
    );
  }

  const registerPage = path.join(appRoot, "src", "app", "register", "page.tsx");
  let registerBackup = null;
  if (fs.existsSync(registerPage)) {
    registerBackup = fs.readFileSync(registerPage, "utf8");
    fs.writeFileSync(
      registerPage,
      `"use client";\nexport default function RegisterPage() {\n  return <p className="p-8 text-sm">Licenses are purchased on relaybase.xyz.</p>;\n}\n`,
    );
  }

  try {
    run("pnpm", ["exec", "next", "build"], { DESKTOP_BUILD: "1" });
  } finally {
    if (rootBackup !== null) fs.writeFileSync(rootPage, rootBackup);
    if (loginBackup !== null) fs.writeFileSync(loginPage, loginBackup);
    if (registerBackup !== null) fs.writeFileSync(registerPage, registerBackup);
  }

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
