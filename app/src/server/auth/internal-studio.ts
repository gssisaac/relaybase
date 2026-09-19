import { workerEnvString } from "@/server/cloudflare/worker-env";
import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function internalStudioAuthHeader(): string {
  return (
    workerEnvString("HQ_INTERNAL_AUTH_SECRET") ||
    workerEnvString("HQ_JWT_SECRET") ||
    "dev-hq-jwt-secret-change-me"
  );
}

function studioServerBase(): string {
  const upstream = workerEnvString("STUDIO_UPSTREAM_URL")?.replace(/\/$/, "");
  if (upstream) return upstream;
  return getStudioApiBase().replace(/\/$/, "");
}

export function studioAuthUrl(path: string): string {
  const base = studioServerBase();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
