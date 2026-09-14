/**
 * OpenNext resolves standalone output as
 * `.next/standalone/<packagePath>/.next/...` where `packagePath` is
 * `relative(monorepoRoot, appBuildOutputPath)`.
 *
 * `app/pnpm-lock.yaml` makes OpenNext treat `app/` as the monorepo root
 * (`packagePath` === ""), so it reads `.next/standalone/.next/...` while
 * Next (with `outputFileTracingRoot` at the workspace parent) emits
 * `.next/standalone/app/.next/...`.
 *
 * Mirror the nested `.next` tree to the path OpenNext expects. Safe to run
 * when layouts already match (no-op).
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const standalone = join(appRoot, ".next/standalone");
const nestedNext = join(standalone, "app/.next");
const flatNext = join(standalone, ".next");
const manifest = join(flatNext, "server/pages-manifest.json");

if (!existsSync(nestedNext)) {
  if (existsSync(manifest)) {
    process.exit(0);
  }
  console.error(
    "opennext-standalone-layout: expected .next/standalone/app/.next after next build",
  );
  process.exit(1);
}

if (!existsSync(manifest)) {
  cpSync(nestedNext, flatNext, { recursive: true });
}
