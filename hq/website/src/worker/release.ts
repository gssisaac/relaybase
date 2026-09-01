import type { WorkerEnv } from "./types";

const CDN = "https://download.relaybase.xyz";

/** Flip when shipping the first Intel (x86_64) DMG. */
export const INTEL_MAC_DOWNLOAD_ENABLED = false;

type ArtifactsJson = Record<
  string,
  { sizeBytes?: number; version?: string; arch?: string }
>;

type LatestJson = {
  version?: string;
  platforms?: Record<string, { url?: string; signature?: string }>;
};

export type MacArch = "aarch64" | "x86_64";

export type ReleaseInfo = {
  version: string | null;
  /** Apple Silicon DMG (preferred). Falls back to legacy Universal name. */
  dmgUrlAarch64: string | null;
  /** Intel DMG when published. */
  dmgUrlX86_64: string | null;
  /** Default Mac download = Apple Silicon. */
  dmgUrl: string | null;
};

export async function resolveRelease(env: WorkerEnv): Promise<ReleaseInfo> {
  const artifacts = await readJson<ArtifactsJson>(env, "/release/artifacts.json");
  const latest = await readJson<LatestJson>(env, "/release/latest.json");

  const version =
    latest?.version?.trim() ||
    versionFromAnyArtifact(artifacts) ||
    null;

  const dmgUrlAarch64 = resolveArchDmgUrl({
    version,
    arch: "aarch64",
    artifacts,
    legacyOk: true,
  });
  const dmgUrlX86_64 = resolveArchDmgUrl({
    version,
    arch: "x86_64",
    artifacts,
    legacyOk: false,
  });

  return {
    version,
    dmgUrlAarch64,
    dmgUrlX86_64,
    dmgUrl: dmgUrlAarch64,
  };
}

function resolveArchDmgUrl(opts: {
  version: string | null;
  arch: MacArch;
  artifacts: ArtifactsJson | null;
  legacyOk: boolean;
}): string | null {
  const { version, arch, artifacts, legacyOk } = opts;

  if (version && artifacts) {
    const archName = `Relaybase.${version}.${arch}.dmg`;
    if (artifacts[archName]) return `${CDN}/${archName}`;
    if (legacyOk) {
      const legacyName = `Relaybase.${version}.dmg`;
      if (artifacts[legacyName]) return `${CDN}/${legacyName}`;
    }
  }

  if (version && !artifacts) {
    // No artifacts.json — Apple Silicon still serves legacy un-suffixed key until
    // the next arch-suffixed release; Intel requires an explicit key.
    if (legacyOk) return `${CDN}/Relaybase.${version}.dmg`;
    return null;
  }

  if (!artifacts) return null;

  const archEntry = Object.entries(artifacts).find(([name, meta]) => {
    if (!name.endsWith(".dmg")) return false;
    if (meta.arch === arch) return true;
    return name.includes(`.${arch}.dmg`);
  });
  if (archEntry) return `${CDN}/${archEntry[0]}`;

  if (legacyOk) {
    const legacy = Object.entries(artifacts).find(
      ([name]) =>
        name.endsWith(".dmg") &&
        !name.includes(".aarch64.") &&
        !name.includes(".x86_64."),
    );
    if (legacy) return `${CDN}/${legacy[0]}`;
  }

  return null;
}

function versionFromAnyArtifact(artifacts: ArtifactsJson | null): string | null {
  if (!artifacts) return null;
  for (const [name, meta] of Object.entries(artifacts)) {
    if (meta.version?.trim()) return meta.version.trim();
    const match = name.match(
      /^Relaybase\.(\d+\.\d+\.\d+)(?:\.(?:aarch64|x86_64))?\.dmg$/i,
    );
    if (match?.[1]) return match[1];
  }
  return null;
}

async function readJson<T>(env: WorkerEnv, path: string): Promise<T | null> {
  try {
    const res = await env.ASSETS.fetch(new Request(`https://relaybase.xyz${path}`));
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
