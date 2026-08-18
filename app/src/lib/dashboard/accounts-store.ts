"use client";

import { makeAutoObservable, runInAction } from "mobx";
import { toast } from "sonner";

import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  defaultInboundEnabledByLocalPart,
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

function withInboundEnabled(address: Address, inboundEnabled: boolean): Address {
  return {
    email: address.email,
    ...(address.domain ? { domain: address.domain } : {}),
    ...(address.displayName ? { displayName: address.displayName } : {}),
    ...(inboundEnabled ? {} : { inboundEnabled: false }),
  };
}

function withMobileEnabled(address: Address, mobileEnabled: boolean): Address {
  return {
    email: address.email,
    ...(address.domain ? { domain: address.domain } : {}),
    ...(address.displayName ? { displayName: address.displayName } : {}),
    ...(address.inboundEnabled === false ? { inboundEnabled: false } : {}),
    ...(mobileEnabled ? {} : { mobileEnabled: false }),
  };
}

function resolveCreateLocalParts(input: CreateAddressesInput): string[] {
  const parts =
    Array.isArray(input.localParts) && input.localParts.length
      ? input.localParts
      : input.localPart
        ? [input.localPart]
        : [];
  return [
    ...new Set(
      parts
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

function buildOptimisticAddresses(
  domain: string,
  input: CreateAddressesInput,
): Address[] {
  const displayNames =
    input.displayNames && typeof input.displayNames === "object"
      ? input.displayNames
      : {};
  const inboundByLocal =
    input.inboundEnabledByLocalPart &&
    typeof input.inboundEnabledByLocalPart === "object"
      ? input.inboundEnabledByLocalPart
      : {};
  const singleDisplayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";

  return resolveCreateLocalParts(input).map((local) => {
    const fromMap =
      typeof displayNames[local] === "string"
        ? displayNames[local]!.trim()
        : "";
    const inboundFromMap =
      typeof inboundByLocal[local] === "boolean"
        ? inboundByLocal[local]
        : undefined;
    const inboundEnabled =
      typeof inboundFromMap === "boolean"
        ? inboundFromMap
        : typeof input.inboundEnabled === "boolean"
          ? input.inboundEnabled
          : true;
    return withInboundEnabled(
      {
        email: `${local}@${domain}`,
        domain,
        ...(fromMap || singleDisplayName
          ? { displayName: fromMap || singleDisplayName }
          : {}),
      },
      inboundEnabled,
    );
  });
}

export type CreateAddressesInput = {
  localPart?: string;
  localParts?: string[];
  displayName?: string;
  displayNames?: Record<string, string>;
  inboundEnabled?: boolean;
  inboundEnabledByLocalPart?: Record<string, boolean>;
};

export type MxConflictRecord = {
  id: string;
  name: string;
  content: string;
  priority?: number;
};

class CreateMxConflictError extends Error {
  mxConflicts: MxConflictRecord[];
  domain: string;

  constructor(domain: string, mxConflicts: MxConflictRecord[]) {
    super("Non-Cloudflare MX records exist for this domain.");
    this.name = "CreateMxConflictError";
    this.domain = domain;
    this.mxConflicts = mxConflicts;
  }
}

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
  /** Emails with an in-flight inbound PATCH (optimistic UI already applied). */
  inboundPendingEmails: string[] = [];
  /** Emails with an in-flight mobile-enabled PATCH (optimistic UI already applied). */
  mobilePendingEmails: string[] = [];
  /** Emails optimistically inserted while create() is in flight. */
  creatingEmails: string[] = [];
  /** Pending create blocked by a non-Cloudflare MX conflict, awaiting approval. */
  mxConflictDomain: string | null = null;
  mxConflicts: MxConflictRecord[] = [];
  mxResolving = false;
  /** Last create input blocked by MX conflict, replayed on approval. */
  private mxConflictPending: {
    domain: string;
    input: CreateAddressesInput;
  } | null = null;

  productId = "";
  apiBase = "/api/email";

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  isInboundPending(email: string): boolean {
    return this.inboundPendingEmails.includes(email.trim().toLowerCase());
  }

  isMobilePending(email: string): boolean {
    return this.mobilePendingEmails.includes(email.trim().toLowerCase());
  }

  isCreating(email: string): boolean {
    return this.creatingEmails.includes(email.trim().toLowerCase());
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
   * Optimistically insert addresses, POST in the background, toast on result.
   * Callers may close dialogs immediately and `void` this (still awaitable for seeds).
   */
  async create(
    domain: string,
    input: CreateAddressesInput,
    opts: { forceMxResolve?: boolean } = {},
  ): Promise<Address[]> {
    const key = domain.trim().toLowerCase();
    if (!key) throw new Error("Select a domain before adding senders");

    const optimistic = buildOptimisticAddresses(key, input);
    if (!optimistic.length) {
      throw new Error("localPart or localParts is required");
    }
    const optimisticEmails = new Set(
      optimistic.map((address) => address.email.toLowerCase()),
    );

    const snapshotBefore = this.addressesByDomain[key] ?? [];
    const pendingEmails = [...optimisticEmails];
    let optimisticList: Address[] = [];
    runInAction(() => {
      this.error = null;
      this.message = null;
      const byEmail = new Map(
        snapshotBefore.map((a) => [a.email.toLowerCase(), a] as const),
      );
      for (const address of optimistic) {
        byEmail.set(address.email.toLowerCase(), address);
      }
      optimisticList = [...byEmail.values()];
      this.addressesByDomain[key] = optimisticList;
      this.creatingEmails = [
        ...new Set([...this.creatingEmails, ...pendingEmails]),
      ];
    });
    // Don't persist optimistic create rows — only confirmed addresses go to disk.

    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/addresses?domain=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            ...(opts.forceMxResolve ? { forceMxResolve: true } : {}),
          }),
        },
      );
      const data = await readResponseJson<{
        address?: Address;
        addresses?: Address[];
        error?: string;
        mxConflict?: boolean;
        domain?: string;
        mxConflicts?: MxConflictRecord[];
      }>(res);
      if (data.mxConflict) {
        const conflicts = data.mxConflicts ?? [];
        runInAction(() => {
          this.mxConflictDomain = data.domain ?? key;
          this.mxConflicts = conflicts;
          this.mxConflictPending = { domain: key, input };
        });
        throw new CreateMxConflictError(data.domain ?? key, conflicts);
      }
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
      });

      await this.persistCache(key, nextList);
      clearEmailCache(this.productId, `addresses:${key}`);
      clearEmailCache(this.productId, "addresses:all");
      notifyAddressesChanged({
        domain: key,
        emails: created.map((a) => a.email),
      });
      toast.success(
        created.length === 1
          ? `Registered ${created[0]!.email}`
          : `Registered ${created.length} accounts`,
      );

      return created;
    } catch (e) {
      if (e instanceof CreateMxConflictError) {
        let reverted: Address[] = [];
        runInAction(() => {
          const current = this.addressesByDomain[key] ?? [];
          const preexisting = new Set(
            snapshotBefore.map((a) => a.email.toLowerCase()),
          );
          reverted = current.filter((a) => {
            const email = a.email.toLowerCase();
            if (!optimisticEmails.has(email)) return true;
            return preexisting.has(email);
          });
          const byEmail = new Map(
            reverted.map((a) => [a.email.toLowerCase(), a] as const),
          );
          for (const address of snapshotBefore) {
            if (optimisticEmails.has(address.email.toLowerCase())) {
              byEmail.set(address.email.toLowerCase(), address);
            }
          }
          reverted = [...byEmail.values()];
          this.addressesByDomain[key] = reverted;
        });
        throw e;
      }
      const message = e instanceof Error ? e.message : "Failed to add";
      let reverted: Address[] = [];
      runInAction(() => {
        const current = this.addressesByDomain[key] ?? [];
        // Drop optimistic rows that were not already present before create.
        const preexisting = new Set(
          snapshotBefore.map((a) => a.email.toLowerCase()),
        );
        reverted = current.filter((a) => {
          const email = a.email.toLowerCase();
          if (!optimisticEmails.has(email)) return true;
          return preexisting.has(email);
        });
        // Restore prior versions for emails that already existed.
        const byEmail = new Map(
          reverted.map((a) => [a.email.toLowerCase(), a] as const),
        );
        for (const address of snapshotBefore) {
          if (optimisticEmails.has(address.email.toLowerCase())) {
            byEmail.set(address.email.toLowerCase(), address);
          }
        }
        reverted = [...byEmail.values()];
        this.addressesByDomain[key] = reverted;
      });
      toast.error(message);
      throw e instanceof Error ? e : new Error(message);
    } finally {
      runInAction(() => {
        this.creatingEmails = this.creatingEmails.filter(
          (email) => !optimisticEmails.has(email),
        );
      });
    }
  }

  clearMxConflict() {
    runInAction(() => {
      this.mxConflictDomain = null;
      this.mxConflicts = [];
      this.mxConflictPending = null;
      this.mxResolving = false;
    });
  }

  /** Re-run the blocked create after the user approves MX record removal. */
  async resolveMxConflict(): Promise<Address[]> {
    const pending = this.mxConflictPending;
    if (!pending) {
      this.clearMxConflict();
      return [];
    }
    const { domain, input } = pending;
    runInAction(() => {
      this.mxResolving = true;
    });
    try {
      const created = await this.create(domain, input, { forceMxResolve: true });
      this.clearMxConflict();
      return created;
    } catch (e) {
      if (e instanceof CreateMxConflictError) {
        runInAction(() => {
          this.mxConflictDomain = domain;
          this.mxConflicts = e.mxConflicts;
          this.mxConflictPending = { domain, input };
        });
      } else {
        this.clearMxConflict();
      }
      throw e;
    } finally {
      runInAction(() => {
        this.mxResolving = false;
      });
    }
  }

  /** Seed the standard product local-parts for a domain (DomainStore jobs). */
  async createDefaults(domain: string): Promise<string[]> {
    const created = await this.create(domain, {
      localParts: [...DEFAULT_ADDRESS_LOCAL_PARTS],
      displayNames: { ...DEFAULT_ADDRESS_DISPLAY_NAMES },
      inboundEnabledByLocalPart: defaultInboundEnabledByLocalPart(
        DEFAULT_ADDRESS_LOCAL_PARTS,
      ),
    });
    return created.map((a) => a.email);
  }

  /**
   * Optimistically flip inboundEnabled in the list, PATCH in the background,
   * toast when the Worker/CF update finishes (or revert + toast on failure).
   */
  async setInboundEnabled(
    domain: string,
    email: string,
    inboundEnabled: boolean,
  ): Promise<void> {
    const key = domain.trim().toLowerCase();
    const emailKey = email.trim().toLowerCase();
    if (!key || !emailKey) throw new Error("Domain and email are required");

    const prevList = this.addressesByDomain[key] ?? [];
    const index = prevList.findIndex(
      (a) => a.email.toLowerCase() === emailKey,
    );
    if (index < 0) throw new Error("Address not found");

    const previous = prevList[index]!;
    const previousEnabled = previous.inboundEnabled !== false;
    if (previousEnabled === inboundEnabled) return;

    const optimistic = withInboundEnabled(previous, inboundEnabled);
    const optimisticList = [...prevList];
    optimisticList[index] = optimistic;

    runInAction(() => {
      this.addressesByDomain[key] = optimisticList;
      if (!this.inboundPendingEmails.includes(emailKey)) {
        this.inboundPendingEmails = [...this.inboundPendingEmails, emailKey];
      }
    });
    void this.persistCache(key, optimisticList);

    try {
      const res = await desktopAwareFetch(`${this.apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailKey, inboundEnabled }),
      });
      const data = await readResponseJson<{
        address?: Address;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to update inbound");

      const confirmed = data.address
        ? withInboundEnabled(
            data.address,
            data.address.inboundEnabled !== false,
          )
        : optimistic;

      let nextList: Address[] = [];
      runInAction(() => {
        const list = this.addressesByDomain[key] ?? [];
        const i = list.findIndex((a) => a.email.toLowerCase() === emailKey);
        if (i >= 0) {
          nextList = [...list];
          nextList[i] = confirmed;
          this.addressesByDomain[key] = nextList;
        } else {
          nextList = list;
        }
      });
      await this.persistCache(key, nextList);
      clearEmailCache(this.productId, `addresses:${key}`);
      clearEmailCache(this.productId, "addresses:all");
      notifyAddressesChanged({ domain: key, emails: [emailKey] });
      toast.success(
        inboundEnabled
          ? "Inbound mail enabled"
          : "Inbound mail blocked (dropped)",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update inbound";
      let reverted: Address[] = [];
      runInAction(() => {
        const list = this.addressesByDomain[key] ?? [];
        const i = list.findIndex((a) => a.email.toLowerCase() === emailKey);
        if (i >= 0) {
          reverted = [...list];
          reverted[i] = previous;
          this.addressesByDomain[key] = reverted;
        } else {
          reverted = list;
        }
      });
      void this.persistCache(key, reverted);
      toast.error(message);
    } finally {
      runInAction(() => {
        this.inboundPendingEmails = this.inboundPendingEmails.filter(
          (item) => item !== emailKey,
        );
      });
    }
  }

  /**
   * Optimistically flip mobileEnabled in the list, PATCH in the background,
   * toast when the Worker update finishes (or revert + toast on failure).
   */
  async setMobileEnabled(
    domain: string,
    email: string,
    mobileEnabled: boolean,
  ): Promise<void> {
    const key = domain.trim().toLowerCase();
    const emailKey = email.trim().toLowerCase();
    if (!key || !emailKey) throw new Error("Domain and email are required");

    const prevList = this.addressesByDomain[key] ?? [];
    const index = prevList.findIndex(
      (a) => a.email.toLowerCase() === emailKey,
    );
    if (index < 0) throw new Error("Address not found");

    const previous = prevList[index]!;
    const previousEnabled = previous.mobileEnabled !== false;
    if (previousEnabled === mobileEnabled) return;

    const optimistic = withMobileEnabled(previous, mobileEnabled);
    const optimisticList = [...prevList];
    optimisticList[index] = optimistic;

    runInAction(() => {
      this.addressesByDomain[key] = optimisticList;
      if (!this.mobilePendingEmails.includes(emailKey)) {
        this.mobilePendingEmails = [...this.mobilePendingEmails, emailKey];
      }
    });
    void this.persistCache(key, optimisticList);

    try {
      const res = await desktopAwareFetch(`${this.apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailKey, mobileEnabled }),
      });
      const data = await readResponseJson<{
        address?: Address;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to update mobile access");

      const confirmed = data.address
        ? withMobileEnabled(
            data.address,
            data.address.mobileEnabled !== false,
          )
        : optimistic;

      let nextList: Address[] = [];
      runInAction(() => {
        const list = this.addressesByDomain[key] ?? [];
        const i = list.findIndex((a) => a.email.toLowerCase() === emailKey);
        if (i >= 0) {
          nextList = [...list];
          nextList[i] = confirmed;
          this.addressesByDomain[key] = nextList;
        } else {
          nextList = list;
        }
      });
      await this.persistCache(key, nextList);
      clearEmailCache(this.productId, `addresses:${key}`);
      clearEmailCache(this.productId, "addresses:all");
      notifyAddressesChanged({ domain: key, emails: [emailKey] });
      toast.success(
        mobileEnabled
          ? "Mobile access enabled for this account"
          : "Mobile access disabled for this account",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update mobile access";
      let reverted: Address[] = [];
      runInAction(() => {
        const list = this.addressesByDomain[key] ?? [];
        const i = list.findIndex((a) => a.email.toLowerCase() === emailKey);
        if (i >= 0) {
          reverted = [...list];
          reverted[i] = previous;
          this.addressesByDomain[key] = reverted;
        } else {
          reverted = list;
        }
      });
      void this.persistCache(key, reverted);
      toast.error(message);
    } finally {
      runInAction(() => {
        this.mobilePendingEmails = this.mobilePendingEmails.filter(
          (item) => item !== emailKey,
        );
      });
    }
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
