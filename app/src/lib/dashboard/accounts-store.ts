"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
} from "@/lib/dashboard/default-addresses";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import { desktopAwareFetch } from "@/lib/desktop/api-base";
import { clearEmailCache } from "@/email/components/email-cached-fetch";
import type { Address } from "@/email/components/types";

export type CreateAddressesInput = {
  localPart?: string;
  localParts?: string[];
  displayName?: string;
  displayNames?: Record<string, string>;
};

export class AccountsStore {
  /** Addresses keyed by domain (lowercase). */
  addressesByDomain: Record<string, Address[]> = {};
  loadingDomain: string | null = null;
  refreshingDomain: string | null = null;
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

  clearError() {
    this.error = null;
  }

  clearMessage() {
    this.message = null;
  }

  async refresh(domain: string, force = false): Promise<void> {
    const key = domain.trim().toLowerCase();
    if (!key || !this.productId) {
      runInAction(() => {
        this.loadingDomain = null;
        this.refreshingDomain = null;
      });
      return;
    }

    const hasData = (this.addressesByDomain[key]?.length ?? 0) > 0;
    runInAction(() => {
      this.error = null;
      if (!hasData) this.loadingDomain = key;
      this.refreshingDomain = key;
    });

    try {
      if (force) {
        clearEmailCache(this.productId, `addresses:${key}`);
      }
      const res = await desktopAwareFetch(
        `${this.apiBase}/addresses?domain=${encodeURIComponent(key)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        addresses?: Address[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load addresses");
      }
      runInAction(() => {
        this.addressesByDomain[key] = data.addresses ?? [];
      });
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : "Refresh failed";
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
      const data = (await res.json()) as {
        address?: Address;
        addresses?: Address[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to add");

      const created =
        data.addresses ?? (data.address ? [data.address] : []);

      runInAction(() => {
        const prev = this.addressesByDomain[key] ?? [];
        const byEmail = new Map(
          prev.map((a) => [a.email.toLowerCase(), a] as const),
        );
        for (const address of created) {
          byEmail.set(address.email.toLowerCase(), address);
        }
        this.addressesByDomain[key] = [...byEmail.values()];
        if (created.length === 1) {
          this.message = `Registered ${created[0]!.email}`;
        } else if (created.length > 1) {
          this.message = `Registered ${created.length} accounts`;
        }
      });

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
      const data = (await res.json()) as {
        addresses?: Address[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to delete");

      runInAction(() => {
        if (data.addresses) {
          this.addressesByDomain[key] = data.addresses;
        } else {
          this.addressesByDomain[key] = (
            this.addressesByDomain[key] ?? []
          ).filter((a) => a.email.toLowerCase() !== target);
        }
        this.message = `Deleted ${target}`;
      });

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
