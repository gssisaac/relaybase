import type { WorkerEnv } from "./types";

const CDN = "https://download.relaybase.xyz";

type ArtifactsJson = Record<string, { sizeBytes?: number; version?: string }>;

type LatestJson = {
  version?: string;
};

export type ReleaseInfo = {
  version: string | null;
  dmgUrl: string | null;
};

export async function resolveRelease(env: WorkerEnv): Promise<ReleaseInfo> {
  const artifacts = await readJson<ArtifactsJson>(env, "/release/artifacts.json");
  const latest = await readJson<LatestJson>(env, "/release/latest.json");

  const versionedName = latest?.version?.trim()
    ? `Relaybase.${latest.version.trim()}.dmg`
    : null;
  const versionedDmg =
    versionedName && artifacts?.[versionedName]
      ? ([versionedName, artifacts[versionedName]] as const)
      : undefined;
  const artifactDmg =
    versionedDmg ??
    (artifacts
      ? Object.entries(artifacts).find(([name]) => name.endsWith(".dmg"))
      : undefined);

  const version =
    latest?.version?.trim() ||
    artifactDmg?.[1]?.version?.trim() ||
    versionFromDmgName(artifactDmg?.[0]) ||
    null;

  const dmgUrl = version
    ? `${CDN}/Relaybase.${version}.dmg`
    : artifactDmg
      ? `${CDN}/${artifactDmg[0]}`
      : null;

  return { version, dmgUrl };
}

function versionFromDmgName(name: string | undefined): string | null {
  if (!name) return null;
  const match = name.match(/^Relaybase\.(\d+\.\d+\.\d+)\.dmg$/i);
  return match?.[1] ?? null;
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
