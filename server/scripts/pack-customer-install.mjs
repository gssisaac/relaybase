#!/usr/bin/env node
/**
 * Packs a customer-facing Worker install ZIP:
 * - server/src + package.json + tsconfig
 * - customer-install/wrangler.toml + README (+ .dev.vars.example)
 *
 * Outputs:
 * - server/dist/relaybase-worker-install.zip
 * - website/public/downloads/relaybase-worker-install.zip (if website/ exists)
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
  "kembo",
  "website",
  "public",
  "downloads",
  "relaybase-worker-install.zip",
);

rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });

cpSync(join(serverRoot, "src"), join(staging, "src"), { recursive: true });
if (existsSync(join(serverRoot, "db"))) {
  cpSync(join(serverRoot, "db"), join(staging, "db"), { recursive: true });
}
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

// Copy D1 migration directories so auto_install can `wrangler d1 migrations apply`.
for (const dir of ["migrations-logs", "migrations-inbox", "migrations-app"]) {
  const src = join(serverRoot, dir);
  if (existsSync(src)) {
    cpSync(src, join(staging, dir), { recursive: true });
  }
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

rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", zipPath, "relaybase-worker-install"], {
  cwd: join(serverRoot, "dist"),
  stdio: "inherit",
});

mkdirSync(dirname(websiteOut), { recursive: true });
cpSync(zipPath, websiteOut);

console.log(`Packed ${zipPath}`);
if (existsSync(websiteOut)) {
  console.log(`Copied ${websiteOut}`);
}
