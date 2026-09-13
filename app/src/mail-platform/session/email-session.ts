/**
 * Web session adapter — web-only mail login (team role).
 *
 * Implements the unified `AuthSession` port for the web build. Stores
 * `{ workerUrl, accountEmail, mobilePassword }` in memory and mirrors
 * identity (not password) to `sessionStorage` so a refresh keeps the
 * session active. Login verifies against `GET /mobile/config` on the
 * customer Worker; logout clears both memory and `sessionStorage`.
 *
 * UI/stores read `role`/`isTeamMode`/`accountEmail`/`workerUrl` from here
 * — no `isDesktopRuntime()` branches needed.
 */
import { makeAutoObservable, runInAction } from "mobx";
import type { AuthSession, EmailIdentity } from "../types";

const STORAGE_KEY = "relaybase:email-session";

export type StoredWebSession = {
  workerUrl: string;
  accountEmail: string;
  mobilePassword?: string | null;
};

type SessionSnapshot = {
  identity: { workerUrl: string; accountEmail: string } | null;
  mobilePassword?: string | null;
};

export function getWebTeamAuth(): StoredWebSession | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    __RELAYBASE_TEAM_AUTH__?: StoredWebSession;
  };
  if (w.__RELAYBASE_TEAM_AUTH__?.workerUrl && w.__RELAYBASE_TEAM_AUTH__?.mobilePassword) {
    return w.__RELAYBASE_TEAM_AUTH__;
  }
  const stored = readStored();
  if (stored.identity?.workerUrl && stored.mobilePassword) {
    const auth: StoredWebSession = {
      workerUrl: stored.identity.workerUrl,
      accountEmail: stored.identity.accountEmail,
      mobilePassword: stored.mobilePassword,
    };
    w.__RELAYBASE_TEAM_AUTH__ = auth;
    return auth;
  }
  return null;
}

export function setWebTeamAuth(auth: StoredWebSession | null): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    __RELAYBASE_TEAM_AUTH__?: StoredWebSession;
    __RELAYBASE_WORKER_URL__?: string;
  };
  if (auth) {
    w.__RELAYBASE_TEAM_AUTH__ = auth;
    w.__RELAYBASE_WORKER_URL__ = auth.workerUrl;
  } else {
    delete w.__RELAYBASE_TEAM_AUTH__;
    delete w.__RELAYBASE_WORKER_URL__;
  }
}

function readStored(): SessionSnapshot {
  if (typeof window === "undefined") return { identity: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { identity: null };
    const parsed = JSON.parse(raw) as SessionSnapshot;
    return {
      identity: parsed.identity ?? null,
      mobilePassword: parsed.mobilePassword ?? null,
    };
  } catch {
    return { identity: null };
  }
}

function writeStored(snapshot: SessionSnapshot | null): void {
  if (typeof window === "undefined") return;
  try {
    if (snapshot?.identity) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * Web session store — implements `AuthSession` for the web build.
 *
 * `role` is always `"team"` and `isTeamMode` is always `true` here; an
 * owner using the web build is still a mail-only (team) session.
 */
export class WebSessionStore implements AuthSession {
  ready = false;
  identity: EmailIdentity | null = null;
  mobilePassword: string | null = null;

  private listeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get role(): "team" {
    return "team";
  }

  get isDesktop(): boolean {
    return false;
  }

  get isTeamMode(): boolean {
    return true;
  }

  get accountEmail(): string {
    return this.identity?.accountEmail ?? "";
  }

  get workerUrl(): string {
    return this.identity?.workerUrl ?? "";
  }

  get accountScopeId(): string {
    return this.identity?.accountEmail ?? "";
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.mobilePassword) headers.Authorization = `Bearer ${this.mobilePassword}`;
    if (this.identity?.accountEmail) headers["X-Account-Email"] = this.identity.accountEmail;
    return headers;
  }

  /** Restore identity from sessionStorage on boot. */
  hydrate(): void {
    const stored = readStored();
    runInAction(() => {
      this.identity = stored.identity;
      this.mobilePassword = stored.mobilePassword ?? null;
      this.ready = true;
    });
    if (stored.identity && stored.mobilePassword) {
      setWebTeamAuth({
        workerUrl: stored.identity.workerUrl,
        accountEmail: stored.identity.accountEmail,
        mobilePassword: stored.mobilePassword,
      });
    }
    this.emit();
  }

  get hasStoredIdentity(): boolean {
    return readStored().identity !== null;
  }

  async login(input: EmailIdentity & { mobilePassword: string }): Promise<void> {
    const workerUrl = input.workerUrl.trim().replace(/\/$/, "");
    const accountEmail = input.accountEmail.trim().toLowerCase();
    const password = input.mobilePassword;
    if (!workerUrl || !accountEmail || !password) {
      throw new Error("Worker URL, account email, and password are required.");
    }

    // Verify against GET /mobile/config.
    const res = await fetch(`${workerUrl}/mobile/config`, {
      headers: {
        Authorization: `Bearer ${password}`,
        "X-Account-Email": accountEmail,
      },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Sign in failed. Check your password.");
    }

    runInAction(() => {
      this.identity = { workerUrl, accountEmail };
      this.mobilePassword = password;
      this.ready = true;
    });
    writeStored({
      identity: { workerUrl, accountEmail },
      mobilePassword: password,
    });
    setWebTeamAuth({ workerUrl, accountEmail, mobilePassword: password });
    this.emit();
  }

  async logout(): Promise<void> {
    runInAction(() => {
      this.identity = null;
      this.mobilePassword = null;
    });
    writeStored(null);
    setWebTeamAuth(null);
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createWebSession(): WebSessionStore {
  const store = new WebSessionStore();
  store.hydrate();
  return store;
}

/**
 * Backward-compat alias — older code imports `EmailSessionStore` /
 * `createEmailSession`. The class is functionally identical.
 */
export const EmailSessionStore = WebSessionStore;
export const createEmailSession = createWebSession;
