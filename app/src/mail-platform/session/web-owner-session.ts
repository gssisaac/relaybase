/**
 * Web owner session adapter — web-only console (owner dashboard) login.
 *
 * Implements the unified `AuthSession` port with `role: "owner"`. Backed by
 * `lib/desktop/auth/owner-session`: access tokens in JS memory, refresh
 * tokens mirrored to tab `sessionStorage` (`relaybase:owner-session`) so a
 * same-tab hard reload restores via `restoreWebOwnerSession()`. The passtoken
 * is never stored; closing the tab requires signing in again (N-01).
 *
 * `login()` is intentionally not implemented here: owner sign-in happens in
 * `AccountLoginView` (passtoken form) or the post-install handoff in
 * `WebInstallFlow`, both of which call `ownerLogin()` directly and then
 * `sync()` this store so the rest of the app observes the new identity —
 * the same "bypass the port, call the store action, sync after" pattern
 * desktop's `AppSessionStore.loginWithPasstoken` already uses.
 */
import { makeAutoObservable, runInAction } from "mobx";
import type { AuthSession, EmailIdentity } from "../types";
import { hasOwnerSession, ownerLogout } from "@/lib/desktop/auth";

function readWorkerUrl(): string {
  if (typeof window === "undefined") return "";
  const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
  return w.__RELAYBASE_WORKER_URL__?.trim().replace(/\/$/, "") ?? "";
}

export class WebOwnerSession implements AuthSession {
  ready = false;
  identity: EmailIdentity | null = null;

  private listeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get role(): "owner" {
    return "owner";
  }

  get isDesktop(): boolean {
    return false;
  }

  get isTeamMode(): boolean {
    return false;
  }

  get accountEmail(): string {
    return this.identity?.accountEmail ?? "";
  }

  get workerUrl(): string {
    return this.identity?.workerUrl ?? "";
  }

  get accountScopeId(): string {
    return this.identity?.workerUrl ?? "";
  }

  get mobilePassword(): string | null {
    return null;
  }

  getAuthHeaders(): Record<string, string> {
    // Console transport (desktopAwareFetch -> workerFetch) attaches the
    // Bearer token itself from the in-memory owner session.
    return {};
  }

  async login(): Promise<void> {
    throw new Error("Owner sign-in is handled by the Account Login screen.");
  }

  async logout(): Promise<void> {
    await ownerLogout();
    if (typeof window !== "undefined") {
      const w = window as unknown as { __RELAYBASE_WORKER_URL__?: string };
      delete w.__RELAYBASE_WORKER_URL__;
    }
    runInAction(() => {
      this.identity = null;
    });
    this.emit();
  }

  /** Re-derive identity from the in-memory owner session + worker URL global. */
  sync(): void {
    const workerUrl = readWorkerUrl();
    const loggedIn = hasOwnerSession() && Boolean(workerUrl);
    runInAction(() => {
      this.identity = loggedIn ? { workerUrl, accountEmail: "owner" } : null;
      this.ready = true;
    });
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export function createWebOwnerSession(): WebOwnerSession {
  const store = new WebOwnerSession();
  store.sync();
  return store;
}

export function hasWebOwnerSession(): boolean {
  return hasOwnerSession() && Boolean(readWorkerUrl());
}
