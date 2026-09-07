import fs from "node:fs";
import path from "node:path";

const CDN = "https://download.relaybase.xyz";

type MacArch = "aarch64" | "x86_64";

type ArtifactsJson = Record<
  string,
  { sizeBytes?: number; version?: string; arch?: string }
>;

type LatestJson = {
  version?: string;
};

export type ReleaseInfo = {
  version: string | null;
  dmgUrlAarch64: string | null;
  dmgUrlX86_64: string | null;
};

function readJson<T>(relativePath: string): T | null {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "release",
      relativePath,
    );
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
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

export function resolveRelease(): ReleaseInfo {
  const artifacts = readJson<ArtifactsJson>("artifacts.json");
  const latest = readJson<LatestJson>("latest.json");

  const version =
    latest?.version?.trim() || versionFromAnyArtifact(artifacts) || null;

  return {
    version,
    dmgUrlAarch64: resolveArchDmgUrl({
      version,
      arch: "aarch64",
      artifacts,
      legacyOk: true,
    }),
    dmgUrlX86_64: resolveArchDmgUrl({
      version,
      arch: "x86_64",
      artifacts,
      legacyOk: false,
    }),
  };
}
