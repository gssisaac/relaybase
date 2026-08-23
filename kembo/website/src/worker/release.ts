import type { WorkerEnv } from "./types";

const CDN = "https://download.relaybase.xyz";

type ArtifactsJson = Record<string, { sizeBytes?: number; version?: string }>;

type LatestJson = {
  version?: string;
};

export async function resolveDmgUrl(env: WorkerEnv): Promise<string | null> {
  const artifacts = await readJson<ArtifactsJson>(env, "/release/artifacts.json");
  if (artifacts) {
    const dmg = Object.entries(artifacts).find(([name]) =>
      name.endsWith(".dmg"),
    );
    if (dmg) {
      return `${CDN}/${dmg[0]}`;
    }
  }

  const latest = await readJson<LatestJson>(env, "/release/latest.json");
  if (latest?.version) {
    return `${CDN}/Relaybase.${latest.version}.dmg`;
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
