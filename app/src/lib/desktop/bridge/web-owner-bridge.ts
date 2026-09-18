import {
  ensureAccessToken,
  getOwnerSession,
  hasOwnerSession,
  ownerLogin,
  ownerLogout,
  restoreWebOwnerSession,
} from "@/lib/desktop/auth";
import { loadLocalCredentialsFile, persistLocalCredentialsFile } from "./credentials-local";
import type { DesktopCredentials } from "./credentials";
import type { OwnerSessionStatus } from "./owner";

function readWorkerUrlGlobal(): string {
  if (typeof window === "undefined") return "";
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  return w.__RELAYBASE_WORKER_URL__?.trim().replace(/\/$/, "") ?? "";
}

function setWorkerUrlGlobal(workerUrl: string): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  const normalized = workerUrl.trim().replace(/\/$/, "");
  if (normalized) w.__RELAYBASE_WORKER_URL__ = normalized;
  else delete w.__RELAYBASE_WORKER_URL__;
}

async function mergeWebWorkerUrl(workerUrl: string): Promise<void> {
  const normalized = workerUrl.trim().replace(/\/$/, "");
  if (!normalized) return;
  setWorkerUrlGlobal(normalized);
  const existing = await loadLocalCredentialsFile();
  const base: DesktopCredentials = existing ?? {
    accountId: "",
    installToken: "",
    workerUrl: "",
    workerScriptName: "relaybase-api",
    workerVersion: "",
    relaybaseAccountId: "",
    relaybaseEmail: "",
    relaybaseSession: "",
    cfOauthAccessToken: "",
    cfOauthRefreshToken: "",
    cfOauthAccessExpiresAt: "",
    cfOauthAccountId: "",
    scopeId: "",
  };
  await persistLocalCredentialsFile({
    ...base,
    workerUrl: normalized,
    workerScriptName: base.workerScriptName || "relaybase-api",
  });
}

/** In-memory owner session status for the browser build (no keyring). */
export function webOwnerSessionStatus(workerUrl?: string): OwnerSessionStatus {
  const url =
    (workerUrl?.trim() || readWorkerUrlGlobal()).replace(/\/$/, "") || "";
  const mail = getOwnerSession("mail");
  const console = getOwnerSession("console");
  const hasMailAccess = Boolean(mail?.accessToken);
  const hasConsoleAccess = Boolean(console?.accessToken);
  const hasMailRefresh = Boolean(mail?.refreshToken);
  const hasConsoleRefresh = Boolean(console?.refreshToken);
  const hasRefresh = hasMailRefresh || hasConsoleRefresh;
  const hasAccess = hasMailAccess || hasConsoleAccess;

  return {
    hasMailRefresh,
    hasConsoleRefresh,
    hasMailAccess,
    hasConsoleAccess,
    hasRefresh,
    hasAccess,
    hasPasstoken: false,
    keyringPasstokenPrefix: "",
    workerUrl: url,
    knownWorkerUrls: url ? [url] : [],
    platform: "other",
  };
}

export async function webOwnerLogin(input: {
  workerUrl: string;
  passtoken: string;
}): Promise<OwnerSessionStatus> {
  await mergeWebWorkerUrl(input.workerUrl);
  await ownerLogin({ passtoken: input.passtoken, label: "web" });
  return webOwnerSessionStatus(input.workerUrl);
}

export async function webOwnerBootMail(): Promise<OwnerSessionStatus> {
  // After a hard reload memory is empty; re-mint from tab sessionStorage.
  if (!hasOwnerSession()) await restoreWebOwnerSession();
  await ensureAccessToken("mail");
  return webOwnerSessionStatus();
}

export async function webOwnerUnlockConsole(): Promise<OwnerSessionStatus> {
  if (!hasOwnerSession()) await restoreWebOwnerSession();
  await ensureAccessToken("console");
  if (!getOwnerSession("console")?.accessToken) {
    throw new Error("Console unlock failed.");
  }
  return webOwnerSessionStatus();
}

export async function webOwnerLogout(): Promise<void> {
  await ownerLogout();
  if (!hasOwnerSession()) {
    setWorkerUrlGlobal("");
  }
}

export async function webOwnerSetupAdmin(input: {
  workerUrl: string;
  pepper: string;
}): Promise<{ passtoken: string }> {
  await mergeWebWorkerUrl(input.workerUrl);
  const res = await fetch("/api/cloudflare/setup-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workerUrl: input.workerUrl.trim().replace(/\/$/, ""),
      pepper: input.pepper.trim(),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    passtoken?: string;
    error?: string;
  };
  if (!res.ok || !data.passtoken) {
    throw new Error(data.error || `Setup failed (${res.status})`);
  }
  return { passtoken: data.passtoken };
}
