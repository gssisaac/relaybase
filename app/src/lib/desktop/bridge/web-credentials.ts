import type { DesktopCredentials } from "./credentials";

const STORAGE_KEY = "relaybase.web.credentials";

const EMPTY: DesktopCredentials = {
  accountId: "",
  installToken: "",
  workerUrl: "",
  workerScriptName: "",
  workerVersion: "",
  relaybaseAccountId: "",
  relaybaseEmail: "",
  relaybaseSession: "",
  cfOauthAccessToken: "",
  cfOauthRefreshToken: "",
  cfOauthAccessExpiresAt: "",
  cfOauthAccountId: "",
  scopeId: "",
  cfApiTokenUserConfirmed: false,
};

export function loadWebCredentials(): DesktopCredentials | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DesktopCredentials>;
    if (!parsed.workerUrl?.trim() && !parsed.accountId?.trim()) return null;
    return { ...EMPTY, ...parsed };
  } catch {
    return null;
  }
}

export function saveWebCredentials(next: DesktopCredentials): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearWebCredentialsWorkerFields(): void {
  const existing = loadWebCredentials();
  if (!existing) return;
  saveWebCredentials({
    ...existing,
    accountId: "",
    workerUrl: "",
    workerScriptName: "",
    workerVersion: "",
    cfOauthAccountId: "",
  });
}
