import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function getKemboOpsKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).KEMBO_OPS ?? null;
  } catch {
    return null;
  }
}

export async function getRelaybaseAppDogfoodKv(): Promise<KVNamespace | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return (env as CloudflareEnv).RELAYBASE_APP_DOGFOOD ?? null;
  } catch {
    return null;
  }
}
