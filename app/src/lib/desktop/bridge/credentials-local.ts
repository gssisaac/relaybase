import type { DesktopCredentials } from "./credentials";

export async function loadLocalCredentialsFile(): Promise<DesktopCredentials | null> {
  try {
    const res = await fetch("/api/local-credentials", { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as DesktopCredentials | null;
  } catch {
    return null;
  }
}
