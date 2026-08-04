import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getRelaybaseAppKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).RELAYBASE_APP ?? null;
  } catch {
    return null;
  }
}

export async function getRelaybaseApiKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).RELAYBASE_API ?? null;
  } catch {
    return null;
  }
}

interface CloudflareEnv {
  RELAYBASE_APP?: KVNamespace;
  RELAYBASE_API?: KVNamespace;
}
