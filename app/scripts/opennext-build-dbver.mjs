/**
 * OpenNext build for hq-relaybase-web-app-dbver (see opennext-build.mjs).
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
  execSync("pnpm exec opennextjs-cloudflare build -c wrangler.web.dbver.jsonc", {
    stdio: "inherit",
    cwd: appRoot,
    env: process.env,
  });
} finally {
  if (hadAppLock && existsSync(appLockBak)) {
    renameSync(appLockBak, appLock);
  }
}
