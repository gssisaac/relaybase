/**
 * Email-mode session — web-only mail login.
 *
 * Stores `{ workerUrl, accountEmail, mobilePassword }` in memory and
 * mirrors the non-secret parts to `sessionStorage` so a page refresh
 * keeps the identity (the password is re-prompted on cold boot).
 *
 * Login verifies against `GET /mobile/config` on the customer Worker.
 * Logout clears both memory and `sessionStorage`.
 */
import { makeAutoObservable, runInAction } from "mobx";
import type { MailSession, EmailIdentity } from "../types";

const STORAGE_KEY = "relaybase:email-session";

type StoredIdentity = {
  workerUrl: string;
  accountEmail: string;
};

type SessionSnapshot = {
  identity: StoredIdentity | null;
};

function readStored(): SessionSnapshot {
  if (typeof window === "undefined") return { identity: null };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { identity: null };
    const parsed = JSON.parse(raw) as SessionSnapshot;
    return { identity: parsed.identity ?? null };
  } catch {
    return { identity: null };
  }
}

function writeStored(identity: StoredIdentity | null): void {
  if (typeof window === "undefined") return;
  try {
    if (identity) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ identity }));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // private mode / quota — ignore
  }
}

export class EmailSessionStore implements MailSession {
  ready = false;
  identity: EmailIdentity | null = null;
  /** Mobile password — memory only, never persisted. */
  mobilePassword: string | null = null;

  private listeners = new Set<() => void>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** Restore identity from sessionStorage on boot. Password must be re-entered. */
  hydrate(): void {
    const stored = readStored();
    runInAction(() => {
      this.identity = stored.identity;
      // Password is not restored — user must log in again after a cold boot.
      this.mobilePassword = null;
      this.ready = true;
    });
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
    writeStored({ workerUrl, accountEmail });
    this.emit();
  }

  async logout(): Promise<void> {
    runInAction(() => {
      this.identity = null;
      this.mobilePassword = null;
    });
    writeStored(null);
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

export function createEmailSession(): EmailSessionStore {
  const store = new EmailSessionStore();
  store.hydrate();
  return store;
}
