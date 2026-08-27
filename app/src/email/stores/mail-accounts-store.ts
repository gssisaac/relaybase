"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  ensureAccountColors,
  getAccountColor,
  type AccountColorMap,
} from "@/email/lib/accounts/account-colors";
import { loadEmailPrefs, saveEmailPrefs } from "@/email/lib/prefs/email-prefs";
import {
  hydrateEnabledAccounts,
  sortAddressesByLocalPart,
  writeEnabledAccounts,
} from "@/email/lib/accounts/enabled-accounts";
import type { Address } from "@/email/components/mailbox/types";
import type { DesktopTeamLogin } from "@/lib/desktop/bridge";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api";

/**
 * Email-side account UX: available addresses (for Add account dialog) +
 * which addresses are enabled in the mail sidebar. Does not create addresses
 * — that stays on Dashboard AccountsStore.
 */
export class MailAccountsStore {
  availableAddresses: Address[] = [];
  enabledAccounts: string[] = [];
  accountColors: AccountColorMap = {};
  signatures: Record<string, string> = {};
  loading = true;
  error: string | null = null;

  private userId = "";
  private apiBase = "/api/email";
  private teamLogin: DesktopTeamLogin | null = null;
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

  get isTeamMode(): boolean {
    return Boolean(this.teamLogin);
  }

  configure(input: {
    userId: string;
    apiBase: string;
    teamLogin?: DesktopTeamLogin | null;
  }) {
    const userChanged = this.userId !== input.userId;
    const apiChanged =
      this.apiBase !== (input.apiBase.replace(/\/$/, "") || "/api/email");
    const teamChanged = this.teamLogin !== (input.teamLogin ?? null);
    this.userId = input.userId;
    this.apiBase = input.apiBase.replace(/\/$/, "") || "/api/email";
    this.teamLogin = input.teamLogin ?? null;
    if (userChanged) {
      this.hydrated = false;
      void this.hydrateEnabled();
    }
    if (this.started && (userChanged || apiChanged || teamChanged)) {
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
    // Team mode: the authenticated account is the only one in scope. Seed it
    // directly from teamLogin instead of calling the admin /console/addresses
    // endpoint (team users have no admin token).
    if (this.teamLogin) {
      const email = this.teamLogin.accountEmail.toLowerCase();
      const seeded: Address = { email, domain: email.split("@")[1] ?? "" };
      runInAction(() => {
        this.availableAddresses = [seeded];
        this.enabledAccounts = [email];
        this.loading = false;
        this.error = null;
      });
      this.ensureColors();
      return;
    }
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

  /** Persist a per-account signature to local email prefs (phase 1). */
  setSignature(email: string, signature: string) {
    const key = email.trim().toLowerCase();
    const next = { ...this.signatures, [key]: signature };
    this.signatures = next;
    void saveEmailPrefs({
      version: 1,
      accountColors: this.accountColors,
      signatures: next,
    });
  }

  getSignature(email: string): string {
    return this.signatures[email.trim().toLowerCase()] ?? "";
  }

  /** Persist a per-account color to local email prefs. */
  setAccountColor(email: string, color: string) {
    const key = email.trim().toLowerCase();
    const nextColors = { ...this.accountColors };
    if (color) nextColors[key] = color;
    else delete nextColors[key];
    this.accountColors = nextColors;
    void saveEmailPrefs({
      version: 1,
      accountColors: nextColors,
      signatures: this.signatures,
    });
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
        this.signatures = prefs.signatures ?? {};
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
      void saveEmailPrefs({
        version: 1,
        accountColors: nextMap,
        signatures: this.signatures,
      });
    }
  }
}
