// Fetches the hosted worker-install manifest + ZIP and stages the worker.js
// source entirely in memory (no disk) — ported from
// desktop/src-tauri/src/auto_install/manifest.rs.
import { createHash } from "node:crypto";
import { findZipFile, readZip } from "./unzip";

const DEFAULT_MANIFEST_URL =
  "https://github.com/strum-us/relaybase-worker/releases/latest/download/worker-install-manifest.json";

export type WorkerInstallManifest = {
  version: string;
  zipUrl: string;
  zipSha256: string;
  publishedAt: string;
  workerJs?: string;
  workerJsUrl?: string;
  notes?: string;
};

function manifestUrl(): string {
  return process.env.RELAYBASE_INSTALL_MANIFEST_URL?.trim() || DEFAULT_MANIFEST_URL;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function camelizeManifest(raw: Record<string, unknown>): WorkerInstallManifest {
  return {
    version: String(raw.version ?? ""),
    zipUrl: String(raw.zipUrl ?? raw.zip_url ?? ""),
    zipSha256: String(raw.zipSha256 ?? raw.zip_sha256 ?? ""),
    publishedAt: String(raw.publishedAt ?? raw.published_at ?? ""),
    workerJs: optionalString(raw.workerJs ?? raw.worker_js),
    workerJsUrl: optionalString(raw.workerJsUrl ?? raw.worker_js_url),
    notes: optionalString(raw.notes),
  };
}

export async function fetchInstallManifest(): Promise<WorkerInstallManifest> {
  const url = manifestUrl();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Install manifest request failed (HTTP ${res.status}): ${url}`);
  }
  return camelizeManifest(await res.json());
}

function toml(raw: string, key: string): string | null {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (!trimmed.startsWith(key)) continue;
    const rest = trimmed.slice(key.length).trimStart();
    if (!rest.startsWith("=")) continue;
    const v = rest.slice(1).trim().replace(/^"|"$/g, "");
    if (v) return v;
  }
  return null;
}

/** Current Worker /health exposes d1Bound + schemaMigrate: reconcile-v1. */
function workerJsIsCurrent(source: string): boolean {
  return source.includes("d1Bound") && source.includes("reconcile-v1");
}

export type StagedInstallPackage = {
  workerJs: string;
  version: string;
  desktopVersion: string | null;
};

/** Download the versioned install ZIP, verify SHA-256, and read worker.js + wrangler.toml. */
export async function stageInstallPackage(
  manifest: WorkerInstallManifest,
  onLog?: (line: string) => void,
): Promise<StagedInstallPackage> {
  onLog?.(`Downloading Worker install v${manifest.version.trim()}…`);
  const res = await fetch(manifest.zipUrl);
  if (!res.ok) {
    throw new Error(`Install package download failed (HTTP ${res.status}): ${manifest.zipUrl}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (manifest.zipSha256 && hash.toLowerCase() !== manifest.zipSha256.trim().toLowerCase()) {
    throw new Error(
      `Install package SHA-256 mismatch (expected ${manifest.zipSha256.trim()}, got ${hash})`,
    );
  }
  const zip = readZip(bytes);

  const wranglerBuf = findZipFile(
    zip,
    "relaybase-worker-install/wrangler.toml",
    "wrangler.toml",
  );
  if (!wranglerBuf) {
    throw new Error("Install ZIP is missing wrangler.toml. Re-pack with pnpm pack:worker-install.");
  }
  const wrangler = wranglerBuf.toString("utf8");

  const versionFileBuf = findZipFile(zip, "relaybase-worker-install/VERSION", "VERSION");
  const version =
    versionFileBuf?.toString("utf8").trim() ||
    toml(wrangler, "WORKER_VERSION") ||
    manifest.version.trim();

  const candidates = [
    manifest.workerJs,
    version ? `worker.${version}.js` : undefined,
    "worker.js",
  ].filter((s): s is string => Boolean(s?.trim()));
  const fullPaths = candidates.flatMap((c) => [`relaybase-worker-install/${c}`, c]);
  const workerJsBuf = findZipFile(zip, ...fullPaths);
  if (!workerJsBuf) {
    throw new Error(
      "Install ZIP is missing worker.{version}.js (or worker.js). Re-pack with pnpm pack:worker-install.",
    );
  }
  const workerJs = workerJsBuf.toString("utf8");
  if (!workerJsIsCurrent(workerJs)) {
    throw new Error(
      "The hosted install ZIP is too old to initialize an empty database (no d1Bound in worker.js). " +
        "Re-pack with `pnpm pack:worker-install`, deploy the website, then try again.",
    );
  }

  const desktopVersion = toml(wrangler, "DESKTOP_VERSION");
  onLog?.(`Staged Worker install v${version}`);
  return { workerJs, version, desktopVersion };
}
