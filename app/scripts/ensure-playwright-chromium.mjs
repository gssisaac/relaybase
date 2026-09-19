/**
 * Ensures Playwright Chromium is present in the local browser cache.
 * Idempotent — safe to run before every `generate:layout-thumbnails`.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(appRoot, "package.json"));

try {
  require.resolve("playwright");
} catch {
  console.error(
    "playwright is not installed. From app/: pnpm add -D playwright && pnpm exec playwright install chromium",
  );
  process.exit(1);
}

const result = spawnSync("pnpm", ["exec", "playwright", "install", "chromium"], {
  cwd: appRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
