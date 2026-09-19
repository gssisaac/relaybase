"use client";

import {
  clearOwnerSession,
  hasOwnerSession,
  ownerRefresh,
  setOwnerSession,
} from "@/lib/desktop/auth/owner-session";
import { getHqUser, hasHqSession, hqRefreshSession } from "@/lib/hq-auth/session";
import { getStudioApiBase } from "@/studio/api";

type WorkerSessionResponse = {
  workerUrl: string;
  mailAccessToken: string;
  mailRefreshToken: string;
  consoleRefreshToken: string;
  mailExpiresIn: number;
  error?: string;
};

function setWorkerUrlGlobal(workerUrl: string): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  w.__RELAYBASE_WORKER_URL__ = workerUrl.replace(/\/$/, "");
}

function applyWorkerSessionPayload(payload: WorkerSessionResponse): void {
  setWorkerUrlGlobal(payload.workerUrl);
  const mailExpiresAt = Date.now() + Math.max(5, payload.mailExpiresIn) * 1000;
  setOwnerSession(
    {
      accessToken: payload.mailAccessToken,
      refreshToken: payload.mailRefreshToken,
      expiresIn: payload.mailExpiresIn,
      accessExpiresAt: mailExpiresAt,
    },
    "mail",
  );
  setOwnerSession(
    {
      accessToken: "",
      refreshToken: payload.consoleRefreshToken,
      expiresIn: 0,
      accessExpiresAt: 0,
    },
    "console",
  );
}

let workerSessionPromise: Promise<boolean> | null = null;

/** Exchange cloud account session for Worker owner refresh tokens (passtoken stays on server). */
export async function ensureCloudWorkerSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!hasHqSession()) {
    const refreshed = await hqRefreshSession();
    if (!refreshed) return false;
  }

  const user = getHqUser();
  if (!user?.workerUrl) return false;

  if (hasOwnerSession() && getWorkerUrlGlobal() === user.workerUrl.replace(/\/$/, "")) {
    const [mail, consoleNext] = await Promise.all([ownerRefresh("mail"), ownerRefresh("console")]);
    if (mail?.accessToken && consoleNext?.accessToken) return true;
  }

  if (workerSessionPromise) return workerSessionPromise;

  workerSessionPromise = (async () => {
    try {
      const { getHqAccessToken } = await import("@/lib/hq-auth/session");
      const token = getHqAccessToken();
      if (!token) return false;

      const res = await fetch(`${getStudioApiBase()}/auth/worker-session`, {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: "{}",
      });
      const body = (await res.json().catch(() => ({}))) as WorkerSessionResponse;
      if (!res.ok || !body.mailAccessToken || !body.consoleRefreshToken) {
        clearOwnerSession();
        return false;
      }
      applyWorkerSessionPayload(body);
      const consoleNext = await ownerRefresh("console");
      return Boolean(consoleNext?.accessToken);
    } catch {
      return false;
    } finally {
      workerSessionPromise = null;
    }
  })();

  return workerSessionPromise;
}

function getWorkerUrlGlobal(): string {
  if (typeof window === "undefined") return "";
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  return w.__RELAYBASE_WORKER_URL__?.trim().replace(/\/$/, "") ?? "";
}

export async function ensureWebCloudAuth(): Promise<"login" | "studio-only" | "ready"> {
  if (!hasHqSession()) {
    const ok = await hqRefreshSession();
    if (!ok) return "login";
  }
  const user = getHqUser();
  if (!user?.workerUrl) return "studio-only";
  const workerOk = await ensureCloudWorkerSession();
  return workerOk ? "ready" : "studio-only";
}

export function clearCloudWorkerSession(): void {
  clearOwnerSession();
  if (typeof window !== "undefined") {
    const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
    delete w.__RELAYBASE_WORKER_URL__;
  }
}
