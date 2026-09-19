#!/usr/bin/env node
/**
 * Web install OAuth and /api/install/* require a normal Next server build.
 * `build:desktop` / `build:cf` sets DESKTOP_BUILD=1 (static export) and stashes
 * app/api — `next start` then serves pages but every API route 404s.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const oauthStart = path.join(
  appRoot,
  ".next",
  "server",
  "app",
  "api",
  "oauth",
  "start",
  "route.js",
);
const installStream = path.join(
  appRoot,
  ".next",
  "server",
  "app",
  "api",
  "install",
  "stream",
  "route.js",
);

const hasApiRoutes =
  fs.existsSync(oauthStart) && fs.existsSync(installStream);

if (!hasApiRoutes) {
  console.error(
    [
      "",
      "Cannot start — this .next build has no /api/oauth or /api/install routes.",
      "",
      "That usually means the last build was the desktop static export (build:desktop / build:cf).",
      "",
      "Web Cloudflare OAuth needs a server build:",
      "",
      "  cd app && pnpm run build && pnpm start",
      "",
      "Or for development:",
      "",
      "  cd app && pnpm dev",
      "",
    ].join("\n"),
  );
  process.exit(1);
}
