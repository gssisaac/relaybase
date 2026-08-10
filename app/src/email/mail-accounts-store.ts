"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  ensureAccountColors,
  getAccountColor,
  type AccountColorMap,
} from "@/email/account-colors";
import { loadEmailPrefs, saveEmailPrefs } from "@/email/email-prefs";
import {
  hydrateEnabledAccounts,
  sortAddressesByLocalPart,
  writeEnabledAccounts,
} from "@/email/enabled-accounts";
import type { Address } from "@/email/components/types";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api-base";

/**
 * Email-side account UX: available addresses (for Add account dialog) +
 * which addresses are enabled in the mail sidebar. Does not create addresses
 * — that stays on Dashboard AccountsStore.
 */
export class MailAccountsStore {
  availableAddresses: Address[] = [];
  enabledAccounts: string[] = [];
  accountColors: AccountColorMap = {};
  loading = true;
  error: string | null = null;

  private userId = "";
  private apiBase = "/api/email";
  private hydrated = false;
  private prefsReady = false;
  private started = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get enabledAddresses(): Address[] {
    const enabled = new Set(this.enabledAccounts.map((e) => e.toLowerCase()));
    return sortAddressesByLocalPart(
      this.availableAddresses.filter((a) =>
        enabled.has(a.email.toLowerCase()),
      ),
    );
  }

  get availableForEnable(): Address[] {
    const enabled = new Set(this.enabledAccounts.map((e) => e.toLowerCase()));
    return sortAddressesByLocalPart(
      this.availableAddresses.filter(
        (a) => !enabled.has(a.email.toLowerCase()),
      ),
    );
  }

  configure(input: { userId: string; apiBase: string }) {
    const userChanged = this.userId !== input.userId;
    const apiChanged =
      this.apiBase !== (input.apiBase.replace(/\/$/, "") || "/api/email");
    this.userId = input.userId;
    this.apiBase = input.apiBase.replace(/\/$/, "") || "/api/email";
    if (userChanged) {
      this.hydrated = false;
      void this.hydrateEnabled();
    }
    if (this.started && (userChanged || apiChanged)) {
      void this.refreshAddresses();
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.hydrateEnabled();
    void this.loadPrefs();
    void this.refreshAddresses();
  }

  private async hydrateEnabled() {
    const userId = this.userId;
    if (!userId) return;
    try {
      const emails = await hydrateEnabledAccounts(userId);
      if (this.userId !== userId) return;
      runInAction(() => {
        this.enabledAccounts = emails;
        this.hydrated = true;
      });
      this.pruneEnabledToAvailable();
      this.ensureColors();
    } catch {
      runInAction(() => {
        this.hydrated = true;
      });
    }
  }

  stop() {
    this.started = false;
  }

  getColor(email: string): string {
    return getAccountColor(email, this.accountColors);
  }

  async refreshAddresses(): Promise<void> {
    if (!this.apiBase) return;
    runInAction(() => {
      this.loading = true;
      this.error = null;
    });
    try {
      const res = await desktopAwareFetch(`${this.apiBase}/addresses?all=1`, {
        cache: "no-store",
      });
      const data = await readResponseJson<{
        addresses?: Address[];
        error?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error || "Failed to load addresses");
      }
      runInAction(() => {
        this.availableAddresses = data.addresses ?? [];
        this.loading = false;
        this.error = null;
      });
      this.pruneEnabledToAvailable();
      this.ensureColors();
    } catch (e) {
      runInAction(() => {
        this.error = isPackagedApiUnavailableError(e)
          ? null
          : friendlyDesktopFetchError(e, "Failed to load addresses");
        this.loading = false;
      });
    }
  }

  setEnabledAccounts(emails: string[]) {
    const next = [...new Set(emails)];
    this.enabledAccounts = next;
    writeEnabledAccounts(this.userId, next);
    this.ensureColors();
  }

  addEnabledAccount(email: string) {
    if (this.enabledAccounts.includes(email)) return;
    const next = [...this.enabledAccounts, email];
    this.enabledAccounts = next;
    writeEnabledAccounts(this.userId, next);
    this.ensureColors();
  }

  removeEnabledAccount(email: string) {
    const next = this.enabledAccounts.filter((item) => item !== email);
    this.enabledAccounts = next;
    writeEnabledAccounts(this.userId, next);
  }

  private pruneEnabledToAvailable() {
    if (!this.hydrated || this.loading || this.error) return;
    if (this.availableAddresses.length === 0) return;
    const valid = new Set(
      this.availableAddresses.map((a) => a.email.toLowerCase()),
    );
    const next = this.enabledAccounts.filter((email) =>
      valid.has(email.toLowerCase()),
    );
    if (next.length !== this.enabledAccounts.length) {
      this.setEnabledAccounts(next);
    }
  }

  private async loadPrefs() {
    try {
      const prefs = await loadEmailPrefs();
      runInAction(() => {
        this.accountColors = prefs.accountColors;
        this.prefsReady = true;
      });
      this.ensureColors();
    } catch {
      runInAction(() => {
        this.prefsReady = true;
      });
    }
  }

  private ensureColors() {
    if (!this.prefsReady || !this.hydrated) return;
    const { nextMap, changed } = ensureAccountColors(
      this.enabledAccounts,
      this.accountColors,
    );
    if (changed) {
      this.accountColors = nextMap;
      void saveEmailPrefs({ version: 1, accountColors: nextMap });
    }
  }
}
