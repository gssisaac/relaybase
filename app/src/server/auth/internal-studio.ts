import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function internalStudioAuthHeader(): string {
  return (
    process.env.HQ_INTERNAL_AUTH_SECRET?.trim() ||
    process.env.HQ_JWT_SECRET?.trim() ||
    "dev-hq-jwt-secret-change-me"
  );
}

function studioServerBase(): string {
  const upstream = process.env.STUDIO_UPSTREAM_URL?.trim().replace(/\/$/, "");
  if (upstream) return upstream;
  return getStudioApiBase().replace(/\/$/, "");
}

export function studioAuthUrl(path: string): string {
  const base = studioServerBase();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
