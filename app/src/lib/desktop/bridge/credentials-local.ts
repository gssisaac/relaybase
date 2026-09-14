import type { DesktopCredentials } from "./credentials";
import { isDesktopRuntime } from "./invoke";
import { loadWebCredentials, saveWebCredentials } from "./web-credentials";

export async function loadLocalCredentialsFile(): Promise<DesktopCredentials | null> {
  if (isDesktopRuntime()) {
    try {
      const res = await fetch("/api/local-credentials", { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as DesktopCredentials | null;
    } catch {
      return null;
    }
  }
  return loadWebCredentials();
}

export async function persistLocalCredentialsFile(
  next: DesktopCredentials,
): Promise<void> {
  if (isDesktopRuntime()) {
    const res = await fetch("/api/local-credentials", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) throw new Error("Failed to save credentials to ~/.relaybase");
    return;
  }
  saveWebCredentials(next);
}
