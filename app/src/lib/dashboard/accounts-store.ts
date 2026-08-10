"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
} from "@/lib/dashboard/default-addresses";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import {
  dashboardCacheNeedsRefresh,
  loadAccountCountsCache,
  loadAddressesCache,
  saveAccountCountsCache,
  saveAddressesCache,
} from "@/lib/dashboard/dashboard-cache-disk";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api-base";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import type { Address } from "@/email/components/types";

export type CreateAddressesInput = {
  localPart?: string;
  localParts?: string[];
  displayName?: string;
  displayNames?: Record<string, string>;
};

export type AddressCounts = {
  total: number;
  unread: number;
};

export class AccountsStore {
  /** Addresses keyed by domain (lowercase). */
  addressesByDomain: Record<string, Address[]> = {};
  /** ISO fetchedAt from disk/network, keyed by domain (lowercase). */
  fetchedAtByDomain: Record<string, string> = {};
  /** Received/unread counts per address, keyed by domain then email. */
  countsByDomain: Record<string, Record<string, AddressCounts>> = {};
  loadingDomain: string | null = null;
  refreshingDomain: string | null = null;
  countsLoadingDomain: string | null = null;
  saving = false;
  error: string | null = null;
  message: string | null = null;

  productId = "";
  apiBase = "/api/email";

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  configure(input: { productId: string; apiBase: string }) {
    this.productId = input.productId;
    this.apiBase = input.apiBase.replace(/\/$/, "") || "/api/email";
  }

  addressesFor(domain: string): Address[] {
    const key = domain.trim().toLowerCase();
    if (!key) return [];
    return this.addressesByDomain[key] ?? [];
  }

  hasHydrated(domain: string): boolean {
    const key = domain.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.addressesByDomain, key);
  }

  countsFor(domain: string, email: string): AddressCounts | null {
    const domainKey = domain.trim().toLowerCase();
    const emailKey = email.trim().toLowerCase();
    return this.countsByDomain[domainKey]?.[emailKey] ?? null;
  }

  hasHydratedCounts(domain: string): boolean {
    const key = domain.trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(this.countsByDomain, key);
  }

  /**
   * Load disk cache first, then network-refresh when missing/stale (>60s) or
   * forced — same pattern as `refresh()` for addresses. Counts are additive
   * (per-address); a domain with no received mail yet simply has no entry.
   */
  async refreshCounts(domain: string, force = false): Promise<void> {
    const key = domain.trim().toLowerCase();
    if (!key || !this.productId) {
      runInAction(() => {
        if (this.countsLoadingDomain === key) this.countsLoadingDomain = null;
      });
      return;
    }

    let cached = force
      ? null
      : await loadAccountCountsCache<Record<string, AddressCounts>>(key);

    if (cached) {
      runInAction(() => {
        this.countsByDomain[key] = cached!.data;
      });
    }

    const needsNetwork =
      force || !cached || dashboardCacheNeedsRefresh(cached.fetchedAt);
    if (!needsNetwork) return;

    runInAction(() => {
      this.countsLoadingDomain = key;
    });

    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/inbox/counts?domain=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );
      const data = await readResponseJson<{
        counts?: Record<string, AddressCounts>;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load counts");
      const counts = data.counts ?? {};
      runInAction(() => {
        this.countsByDomain[key] = counts;
      });
      await saveAccountCountsCache(key, counts);
    } catch {
      // Counts are supplementary — keep any cached values, don't surface
      // this as a page-level error alongside address load failures.
    } finally {
      runInAction(() => {
        if (this.countsLoadingDomain === key) this.countsLoadingDomain = null;
      });
    }
  }

  clearError() {
    this.error = null;
  }

  clearMessage() {
    this.message = null;
  }

  private applyAddresses(domain: string, addresses: Address[], fetchedAt: string) {
    const key = domain.trim().toLowerCase();
    this.addressesByDomain[key] = addresses;
    this.fetchedAtByDomain[key] = fetchedAt;
  }

  private async persistCache(domain: string, addresses: Address[]) {
    const key = domain.trim().toLowerCase();
    await saveAddressesCache(key, addresses);
    runInAction(() => {
      this.fetchedAtByDomain[key] = new Date().toISOString();
    });
  }

  /**
   * Load disk cache first, then network-refresh when missing/stale (>60s) or forced.
   * Cached rows stay visible; only `refreshingDomain` spins while revalidating.
   */
  async refresh(domain: string, force = false): Promise<void> {
    const key = domain.trim().toLowerCase();
    if (!key || !this.productId) {
      runInAction(() => {
        this.loadingDomain = null;
        this.refreshingDomain = null;
      });
      return;
    }

    runInAction(() => {
      this.error = null;
    });

    let cached =
      force ? null : await loadAddressesCache<Address[]>(key);

    // Prefer in-memory hydrate if we already showed this domain this session.
    if (
      !cached &&
      !force &&
      this.hasHydrated(key) &&
      this.fetchedAtByDomain[key]
    ) {
      cached = {
        fetchedAt: this.fetchedAtByDomain[key]!,
        data: this.addressesByDomain[key] ?? [],
      };
    }

    if (cached && !force) {
      runInAction(() => {
        this.applyAddresses(key, cached!.data, cached!.fetchedAt);
        if (this.loadingDomain === key) this.loadingDomain = null;
      });
    }

    const needsNetwork =
      force || !cached || dashboardCacheNeedsRefresh(cached.fetchedAt);

    if (!needsNetwork) {
      runInAction(() => {
        if (this.refreshingDomain === key) this.refreshingDomain = null;
        if (this.loadingDomain === key) this.loadingDomain = null;
      });
      return;
    }

    // Keep cards on screen when we already have rows (disk or memory).
    const keepVisible = this.hasHydrated(key) || Boolean(cached);
    runInAction(() => {
      if (keepVisible) this.refreshingDomain = key;
      else this.loadingDomain = key;
    });

    try {
      if (force) {
        clearEmailCache(this.productId, `addresses:${key}`);
      }
      const res = await desktopAwareFetch(
        `${this.apiBase}/addresses?domain=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );
      const data = await readResponseJson<{
        addresses?: Address[];
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load addresses");
      }
      const addresses = data.addresses ?? [];
      const fetchedAt = new Date().toISOString();
      runInAction(() => {
        this.applyAddresses(key, addresses, fetchedAt);
      });
      await saveAddressesCache(key, addresses);
    } catch (e) {
      runInAction(() => {
        this.error = isPackagedApiUnavailableError(e)
          ? null
          : friendlyDesktopFetchError(e, "Refresh failed");
      });
    } finally {
      runInAction(() => {
        if (this.loadingDomain === key) this.loadingDomain = null;
        if (this.refreshingDomain === key) this.refreshingDomain = null;
      });
    }
  }

  /**
   * Create one or more addresses on a domain. Updates local list and notifies
   * Email MailAccountsStore via accounts-sync.
   */
  async create(
    domain: string,
    input: CreateAddressesInput,
  ): Promise<Address[]> {
    const key = domain.trim().toLowerCase();
    if (!key) throw new Error("Select a domain before adding senders");

    runInAction(() => {
      this.saving = true;
      this.error = null;
      this.message = null;
    });

    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/addresses?domain=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      const data = await readResponseJson<{
        address?: Address;
        addresses?: Address[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to add");

      const created =
        data.addresses ?? (data.address ? [data.address] : []);

      let nextList: Address[] = [];
      runInAction(() => {
        const prev = this.addressesByDomain[key] ?? [];
        const byEmail = new Map(
          prev.map((a) => [a.email.toLowerCase(), a] as const),
        );
        for (const address of created) {
          byEmail.set(address.email.toLowerCase(), address);
        }
        nextList = [...byEmail.values()];
        this.addressesByDomain[key] = nextList;
        if (created.length === 1) {
          this.message = `Registered ${created[0]!.email}`;
        } else if (created.length > 1) {
          this.message = `Registered ${created.length} accounts`;
        }
      });

      await this.persistCache(key, nextList);
      clearEmailCache(this.productId, `addresses:${key}`);
      clearEmailCache(this.productId, "addresses:all");
      notifyAddressesChanged({
        domain: key,
        emails: created.map((a) => a.email),
      });

      return created;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add";
      runInAction(() => {
        this.error = message;
      });
      throw e instanceof Error ? e : new Error(message);
    } finally {
      runInAction(() => {
        this.saving = false;
      });
    }
  }

  /** Seed the standard product local-parts for a domain (DomainStore jobs). */
  async createDefaults(domain: string): Promise<string[]> {
    const created = await this.create(domain, {
      localParts: [...DEFAULT_ADDRESS_LOCAL_PARTS],
      displayNames: { ...DEFAULT_ADDRESS_DISPLAY_NAMES },
    });
    return created.map((a) => a.email);
  }

  async remove(domain: string, email: string): Promise<void> {
    const key = domain.trim().toLowerCase();
    const target = email.trim().toLowerCase();
    if (!key || !target) throw new Error("Domain and email are required");

    runInAction(() => {
      this.saving = true;
      this.error = null;
      this.message = null;
    });

    try {
      const params = new URLSearchParams({ domain: key, email: target });
      const res = await desktopAwareFetch(
        `${this.apiBase}/addresses?${params.toString()}`,
        { method: "DELETE" },
      );
      const data = await readResponseJson<{
        addresses?: Address[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");

      let nextList: Address[] = [];
      runInAction(() => {
        if (data.addresses) {
          nextList = data.addresses;
        } else {
          nextList = (this.addressesByDomain[key] ?? []).filter(
            (a) => a.email.toLowerCase() !== target,
          );
        }
        this.addressesByDomain[key] = nextList;
        this.message = `Deleted ${target}`;
      });

      await this.persistCache(key, nextList);
      clearEmailCache(this.productId, `addresses:${key}`);
      clearEmailCache(this.productId, "addresses:all");
      notifyAddressesChanged({ domain: key, emails: [target] });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to delete";
      runInAction(() => {
        this.error = message;
      });
      throw e instanceof Error ? e : new Error(message);
    } finally {
      runInAction(() => {
        this.saving = false;
      });
    }
  }
}
