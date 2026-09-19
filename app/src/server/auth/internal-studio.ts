import { getStudioApiBase } from "@/studio/lib/studio-origin";

export function internalStudioAuthHeader(): string {
  return (
    process.env.HQ_INTERNAL_AUTH_SECRET?.trim() ||
    process.env.HQ_JWT_SECRET?.trim() ||
    "dev-hq-jwt-secret-change-me"
  );
}

export function studioAuthUrl(path: string): string {
  const base = getStudioApiBase().replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
