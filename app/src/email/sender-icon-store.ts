"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { desktopAwareFetch, readResponseJson } from "@/lib/desktop/api-base";
import {
  desktopGetCacheJson,
  desktopSaveCacheJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

export type SenderIconStatus = "loading" | "ready" | "error";

export type SenderIconEntry = {
  status: SenderIconStatus;
  dataUrl: string | null;
  lastAccessed: number;
};

type PersistedIconStatus = { ok: boolean; at: number };

type PersistedStatusFile = {
  version: number;
  domains: Record<string, PersistedIconStatus>;
};

/** Skip re-probing a domain that had no favicon for this long. */
const FAILED_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
/** Relative path under ~/.relaybase/cache (desktop) / localStorage key (browser). */
const STATUS_DISK_PATH = "favicon-status.json";
const STATUS_STORAGE_KEY = "relaybase:favicon-status:v1";

function domainOfEmail(email: string | undefined | null): string | null {
  const trimmed = (email ?? "").trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  const domain = trimmed.split("@").pop() ?? "";
  if (!domain || !domain.includes(".")) return null;
  return domain;
}

export { domainOfEmail as senderIconDomain };

/**
 * In-memory sender favicon cache for the mail lists / thread view.
 *
 * Images are fetched once per domain through the Worker favicon proxy
 * (`/mail/favicon`, mapped from `/api/email/favicon`) and kept resident as
 * data URLs — virtualized rows re-mounting never re-fetch. Only the
 * success/failed *status* is persisted (`~/.relaybase/cache/favicon-status.json`
 * on desktop) so domains known to have no favicon are not re-probed every
 * session; the image bytes themselves stay memory-only.
 */
export class SenderIconStore {
  /** domain → icon entry (observable; drives SenderAvatar re-render). */
  icons = new Map<string, SenderIconEntry>();
  maxMemoryEntries = 200;

  private apiBase: string;
  private statusByDomain = new Map<string, PersistedIconStatus>();
  private inFlight = new Map<string, Promise<void>>();
  private hydratePromise: Promise<void> | null = null;
  private persistTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(apiBase: string) {
    this.apiBase = apiBase.replace(/\/$/, "");
    makeAutoObservable<
      SenderIconStore,
      "apiBase" | "statusByDomain" | "inFlight" | "hydratePromise" | "persistTimer"
    >(
      this,
      {
        apiBase: false,
        statusByDomain: false,
        inFlight: false,
        hydratePromise: false,
        persistTimer: false,
      },
      { autoBind: true },
    );
    this.hydratePromise = this.hydrateStatus();
  }

  /** Current icon entry for a domain (undefined until load() is called). */
  getIcon(domain: string): SenderIconEntry | undefined {
    return this.icons.get(domain);
  }

  /**
   * Ensure the favicon for `domain` is loaded (fire-and-forget). Safe to call
   * on every row mount — memory hits and in-flight requests are no-ops.
   */
  load(domain: string): void {
    const key = domain.trim().toLowerCase();
    if (!key || !key.includes(".")) return;

    const existing = this.icons.get(key);
    if (existing) {
      existing.lastAccessed = Date.now();
      return;
    }
    if (this.inFlight.has(key)) return;

    const promise = this.loadIcon(key).finally(() => {
      this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
  }

  /** Drop all in-memory images (account switch). Persisted status is kept. */
  clear(): void {
    this.icons.clear();
    this.inFlight.clear();
  }

  private async loadIcon(domain: string): Promise<void> {
    await this.hydratePromise;

    const known = this.statusByDomain.get(domain);
    if (known && !known.ok && Date.now() - known.at < FAILED_RETRY_AFTER_MS) {
      runInAction(() => {
        this.setEntry(domain, { status: "error", dataUrl: null });
      });
      return;
    }

    runInAction(() => {
      this.setEntry(domain, { status: "loading", dataUrl: null });
    });

    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/favicon?domain=${encodeURIComponent(domain)}`,
      );
      const data = await readResponseJson<{ dataUrl?: string | null }>(res);
      if (!res.ok) throw new Error("Favicon proxy request failed");

      const dataUrl = data.dataUrl ?? null;
      runInAction(() => {
        this.setEntry(
          domain,
          dataUrl
            ? { status: "ready", dataUrl }
            : { status: "error", dataUrl: null },
        );
      });
      // A definitive proxy answer (icon or confirmed-absent) is persisted;
      // transient network failures below are not, so they retry next session.
      this.rememberStatus(domain, Boolean(dataUrl));
    } catch {
      runInAction(() => {
        this.setEntry(domain, { status: "error", dataUrl: null });
      });
    }
  }

  private setEntry(
    domain: string,
    entry: Pick<SenderIconEntry, "status" | "dataUrl">,
  ): void {
    this.icons.set(domain, { ...entry, lastAccessed: Date.now() });
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    if (this.icons.size <= this.maxMemoryEntries) return;
    const entries = [...this.icons.entries()].sort(
      (a, b) => a[1].lastAccessed - b[1].lastAccessed,
    );
    const excess = this.icons.size - this.maxMemoryEntries;
    for (let i = 0; i < excess; i++) {
      this.icons.delete(entries[i]![0]);
    }
  }

  private rememberStatus(domain: string, ok: boolean): void {
    this.statusByDomain.set(domain, { ok, at: Date.now() });
    this.schedulePersistStatus();
  }

  private async hydrateStatus(): Promise<void> {
    try {
      let raw: unknown = null;
      if (isDesktopRuntime()) {
        raw = await desktopGetCacheJson(STATUS_DISK_PATH);
      } else if (typeof window !== "undefined") {
        const stored = localStorage.getItem(STATUS_STORAGE_KEY);
        raw = stored ? (JSON.parse(stored) as unknown) : null;
      }
      const parsed = raw as PersistedStatusFile | null;
      if (!parsed || typeof parsed !== "object" || !parsed.domains) return;
      for (const [domain, status] of Object.entries(parsed.domains)) {
        if (
          typeof status?.ok === "boolean" &&
          typeof status?.at === "number"
        ) {
          this.statusByDomain.set(domain, status);
        }
      }
    } catch {
      // Missing/corrupt status cache — start fresh.
    }
  }

  /** Batch writes: many rows resolve at once right after the list mounts. */
  private schedulePersistStatus(): void {
    if (this.persistTimer) return;
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persistStatus();
    }, 1_000);
  }

  private persistStatus(): void {
    const file: PersistedStatusFile = {
      version: 1,
      domains: Object.fromEntries(this.statusByDomain),
    };
    if (isDesktopRuntime()) {
      void desktopSaveCacheJson(STATUS_DISK_PATH, file).catch(() => {
        /* disk write failure — memory cache still works */
      });
      return;
    }
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STATUS_STORAGE_KEY, JSON.stringify(file));
    } catch {
      /* quota exceeded — memory cache still works */
    }
  }
}
