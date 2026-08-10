#!/usr/bin/env node
/**
 * Packs a customer-facing Worker install ZIP:
 * - server/src + package.json + tsconfig
 * - customer-install/wrangler.toml + README (+ .dev.vars.example)
 * - migrations/ + migrations-logs/ (so the desktop app can run `wrangler d1 migrations apply`)
 * - worker-manifest.json (workerVersion + requiredMigrations, read by the desktop app)
 *
 * Outputs:
 * - server/dist/relaybase-worker-install.zip
 * - website/public/downloads/relaybase-worker-install.zip (if website/ exists)
 * - desktop/src-tauri/resources/relaybase-worker-install.zip (bundled into the Tauri app)
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverRoot = join(__dirname, "..");
const repoRoot = join(serverRoot, "..");
const staging = join(serverRoot, "dist", "relaybase-worker-install");
const zipPath = join(serverRoot, "dist", "relaybase-worker-install.zip");
const websiteOut = join(
  repoRoot,
  "website",
  "public",
  "downloads",
  "relaybase-worker-install.zip",
);
const desktopResourceOut = join(
  repoRoot,
  "desktop",
  "src-tauri",
  "resources",
  "relaybase-worker-install.zip",
);

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

cpSync(join(serverRoot, "src"), join(staging, "src"), { recursive: true });
cpSync(join(serverRoot, "package.json"), join(staging, "package.json"));
cpSync(join(serverRoot, "tsconfig.json"), join(staging, "tsconfig.json"));
cpSync(
  join(serverRoot, "customer-install", "wrangler.toml"),
  join(staging, "wrangler.toml"),
);
cpSync(join(serverRoot, "customer-install", "README.md"), join(staging, "README.md"));
cpSync(
  join(serverRoot, "customer-install", ".dev.vars.example"),
  join(staging, ".dev.vars.example"),
);

// Bundle D1 migrations so the desktop app can run `wrangler d1 migrations apply --remote`
// from the extracted install folder. Both databases are optional for customers
// (hosted-only), but the files must be present for the in-app migrator to use them.
const migrationsDir = join(serverRoot, "migrations");
const migrationsLogsDir = join(serverRoot, "migrations-logs");
if (existsSync(migrationsDir)) {
  cpSync(migrationsDir, join(staging, "migrations"), { recursive: true });
}
if (existsSync(migrationsLogsDir)) {
  cpSync(migrationsLogsDir, join(staging, "migrations-logs"), { recursive: true });
}

// Mark package as the install template (avoid colliding with hosted server name in lockfiles).
const pkg = JSON.parse(readFileSync(join(staging, "package.json"), "utf8"));
pkg.name = "relaybase-worker-install";
pkg.private = true;
pkg.scripts = {
  deploy: "wrangler deploy",
  dev: "wrangler dev",
};
writeFileSync(join(staging, "package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

// worker-manifest.json — read by the Tauri app to compare bundled vs deployed worker
// version and to know which migrations the bundled worker expects. Customer installs
// only ever provision + migrate RELAYBASE_LOGS (the dashboard Log page); the waitlist
// DB is hosted-only, so its migrations are bundled for completeness but not listed here.
const requiredMigrations = [];
if (existsSync(join(staging, "migrations-logs"))) {
  requiredMigrations.push("0001_ops_logs");
}
const manifest = {
  workerVersion: pkg.version ?? "0.0.0",
  product: "relaybase",
  scriptName: "relaybase-api",
  requiredMigrations,
  bundledAt: new Date().toISOString(),
};
writeFileSync(
  join(staging, "worker-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);

// Stamp src/version.ts so the bundled Worker reports the same version as the
// manifest (keeps desktop "worker update available" detection accurate).
writeFileSync(
  join(staging, "src", "version.ts"),
  `// Auto-stamped by pack-customer-install.mjs — do not edit by hand.\nexport const WORKER_VERSION = ${JSON.stringify(manifest.workerVersion)};\n`,
);

rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", zipPath, "relaybase-worker-install"], {
  cwd: join(serverRoot, "dist"),
  stdio: "inherit",
});

mkdirSync(dirname(websiteOut), { recursive: true });
cpSync(zipPath, websiteOut);

mkdirSync(dirname(desktopResourceOut), { recursive: true });
cpSync(zipPath, desktopResourceOut);

console.log(`Packed ${zipPath}`);
if (existsSync(websiteOut)) {
  console.log(`Copied ${websiteOut}`);
}
console.log(`Copied ${desktopResourceOut}`);
