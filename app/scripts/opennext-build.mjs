/**
 * OpenNext `findPackagerAndRoot` stops at the first lockfile walking up from
 * `app/`. `app/pnpm-lock.yaml` makes it treat `app/` as the monorepo root, so
 * standalone server paths resolve incorrectly and the Worker 500s on
 * `middleware-manifest.json` dynamic require.
 *
 * Temporarily hide the app-level lock so detection reaches `main/pnpm-lock.yaml`
 * (`packagePath` === `app`, matching `.next/standalone/app/.next/...`).
 */
import { execSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const appLock = join(appRoot, "pnpm-lock.yaml");
const appLockBak = join(appRoot, "pnpm-lock.yaml.__opennext_bak__");

const hadAppLock = existsSync(appLock);

try {
  if (hadAppLock) {
    renameSync(appLock, appLockBak);
  }
  execSync("pnpm exec opennextjs-cloudflare build -c wrangler.web.jsonc", {
    stdio: "inherit",
    cwd: appRoot,
    env: process.env,
  });
} finally {
  if (hadAppLock && existsSync(appLockBak)) {
    renameSync(appLockBak, appLock);
  }
}
