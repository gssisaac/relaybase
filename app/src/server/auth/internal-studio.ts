import { getCloudflareContext } from "@opennextjs/cloudflare";

import { getStudioApiBase } from "@/studio/lib/studio-origin";

function readAuthFromBindings(env: Record<string, unknown>): string | undefined {
  for (const key of ["HQ_INTERNAL_AUTH_SECRET", "HQ_JWT_SECRET"] as const) {
    const value = env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

/** Server-to-server Studio auth (Wrangler secrets on `env`, not always on `process.env`). */
export async function internalStudioAuthHeader(): Promise<string> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const fromBindings = readAuthFromBindings(env as Record<string, unknown>);
    if (fromBindings) return fromBindings;
  } catch {
    /* local dev without worker context */
  }

  const fromProcess =
    process.env.HQ_INTERNAL_AUTH_SECRET?.trim() ||
    process.env.HQ_JWT_SECRET?.trim();
  if (fromProcess) return fromProcess;

  if (process.env.NODE_ENV === "production") {
    throw new Error("HQ_INTERNAL_AUTH_SECRET is not configured on the web Worker");
  }
  return "dev-hq-jwt-secret-change-me";
}

export async function studioAuthUrl(path: string): Promise<string> {
  let base: string | undefined;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const upstream = env.STUDIO_UPSTREAM_URL;
    if (typeof upstream === "string" && upstream.trim()) {
      base = upstream.trim().replace(/\/$/, "");
    }
  } catch {
    /* local dev */
  }

  base ??= process.env.STUDIO_UPSTREAM_URL?.trim().replace(/\/$/, "");
  if (!base) {
    base = getStudioApiBase().replace(/\/$/, "");
  }
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
