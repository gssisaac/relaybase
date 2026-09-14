import type { DesktopCredentials } from "@/lib/desktop/bridge";
import {
  loadLocalCredentialsFile,
  persistLocalCredentialsFile,
} from "@/lib/desktop/bridge/credentials-local";

const STORAGE_KEY = "relaybase.cfApiTokenUserConfirmed.v1";

export const CF_API_TOKEN_PROBE_DISCLAIMER =
  "Relaybase’s automatic permission check can disagree with Cloudflare (rate limits, account filters, or timing). If you added the token and permissions in the dashboard, you can mark setup complete — actual domain and routing API calls will still show errors if something is wrong.";

function normalizeWorkerUrl(workerUrl: string): string {
  return workerUrl.trim().replace(/\/$/, "").toLowerCase();
}

function readMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

/** User attested CF_API_TOKEN + permissions are configured on the Worker. */
export function isCfApiTokenUserConfirmed(
  credentials: Pick<DesktopCredentials, "workerUrl" | "cfApiTokenUserConfirmed"> | null | undefined,
  workerUrl?: string | null,
): boolean {
  if (credentials?.cfApiTokenUserConfirmed) return true;
  const url = workerUrl?.trim() || credentials?.workerUrl?.trim() || "";
  if (!url) return false;
  return readMap()[normalizeWorkerUrl(url)] === true;
}

/** Domain / routing API ready: probe passed, or user marked setup complete. */
export function cfDomainApiReady(
  worker: {
    cfApiTokenSet?: boolean;
    cfApiTokenValid?: boolean;
    workerUrl?: string;
  } | null | undefined,
  credentials: Pick<DesktopCredentials, "workerUrl" | "cfApiTokenUserConfirmed"> | null | undefined,
): boolean {
  if (!worker?.cfApiTokenSet) return false;
  if (worker.cfApiTokenValid !== false) return true;
  return isCfApiTokenUserConfirmed(credentials, worker.workerUrl);
}

export async function setCfApiTokenUserConfirmed(
  workerUrl: string,
  confirmed: boolean,
): Promise<void> {
  const url = normalizeWorkerUrl(workerUrl);
  if (!url) return;
  const map = readMap();
  if (confirmed) map[url] = true;
  else delete map[url];
  writeMap(map);

  const creds = await loadLocalCredentialsFile();
  if (!creds) return;
  const credUrl = normalizeWorkerUrl(creds.workerUrl);
  if (credUrl && credUrl !== url) return;
  await persistLocalCredentialsFile({
    ...creds,
    cfApiTokenUserConfirmed: confirmed,
  });
}
