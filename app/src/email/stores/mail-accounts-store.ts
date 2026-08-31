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
import {
  addressesFromEmails,
  hydrateAvailableAddresses,
  normalizeAddresses,
  writeAvailableAddresses,
} from "@/email/lib/accounts/available-addresses";
import type { Address } from "@/email/components/mailbox/types";
import type { DesktopTeamLogin } from "@/lib/desktop/bridge";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api";

export type LoadPhase = "none" | "loading" | "done";

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
  phase: LoadPhase = "none";
  error: string | null = null;

  private userId = "";
  private apiBase = "/api/email";
  private teamLogin: DesktopTeamLogin | null = null;
  private workerUrl = "";
  private desktopReady = false;
  private hydrated = false;
  private prefsReady = false;
  private started = false;
  private primaryGeneration = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** @deprecated use `phase !== "done"` */
  get loading(): boolean {
    return this.phase !== "done";
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
    workerUrl?: string;
    desktopReady?: boolean;
  }) {
    const userChanged = this.userId !== input.userId;
    const apiChanged =
      this.apiBase !== (input.apiBase.replace(/\/$/, "") || "/api/email");
    const teamChanged = this.teamLogin !== (input.teamLogin ?? null);
    const workerChanged =
      this.workerUrl !== (input.workerUrl?.trim() ?? "");
    const readyChanged =
      this.desktopReady !== Boolean(input.desktopReady);
    this.userId = input.userId;
    this.apiBase = input.apiBase.replace(/\/$/, "") || "/api/email";
    this.teamLogin = input.teamLogin ?? null;
    this.workerUrl = input.workerUrl?.trim() ?? "";
    this.desktopReady = Boolean(input.desktopReady);
    if (userChanged) {
      this.hydrated = false;
      this.phase = "none";
      void this.runPrimaryBootstrap();
    }
    if (
      this.started &&
      this.phase === "done" &&
      (userChanged || apiChanged || teamChanged || workerChanged || readyChanged)
    ) {
      void this.refreshAddresses({ background: true });
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    void this.loadPrefs();
    void this.runPrimaryBootstrap();
  }

  private async runPrimaryBootstrap() {
    if (!this.userId) return;
    const generation = ++this.primaryGeneration;
    runInAction(() => {
      this.phase = "loading";
      this.error = null;
    });
    const hadCatalog = await this.hydrateCatalog();
    if (this.primaryGeneration !== generation) return;

    if (hadCatalog) {
      runInAction(() => {
        this.phase = "done";
      });
      void this.refreshAddresses({ background: true });
      return;
    }

    await this.refreshAddresses({ primary: true });
    if (this.primaryGeneration !== generation) return;
    runInAction(() => {
      this.phase = "done";
    });
  }

  /** Disk catalog + enable-list. Seeds catalog from enable-list on first upgrade. */
  private async hydrateCatalog(): Promise<boolean> {
    const userId = this.userId;
    if (!userId) return false;
    try {
      const [emails, catalog] = await Promise.all([
        hydrateEnabledAccounts(userId),
        hydrateAvailableAddresses(userId),
      ]);
      if (this.userId !== userId) return false;
      let addresses = catalog.addresses;
      let found = catalog.found;
      if (!found && emails.length > 0) {
        addresses = addressesFromEmails(emails);
        found = true;
        writeAvailableAddresses(userId, addresses);
      }
      runInAction(() => {
        this.enabledAccounts = emails;
        this.availableAddresses = addresses;
        this.hydrated = true;
      });
      this.ensureColors();
      return found;
    } catch {
      runInAction(() => {
        this.hydrated = true;
      });
      return false;
    }
  }

  stop() {
    this.started = false;
  }

  getColor(email: string): string {
    return getAccountColor(email, this.accountColors);
  }

  async refreshAddresses(opts?: {
    primary?: boolean;
    background?: boolean;
  }): Promise<void> {
    if (!this.apiBase) return;
    if (!this.desktopReady) return;

    const isPrimary = Boolean(opts?.primary) || this.phase === "loading";

    if (!this.teamLogin && !this.workerUrl) {
      if (isPrimary) {
        runInAction(() => {
          this.error =
            "Worker is not connected. Finish setup to load live mail.";
        });
      }
      return;
    }

    // Team mode: the authenticated account is the only one in scope. Seed it
    // directly from teamLogin instead of calling the admin /console/addresses
    // endpoint (team users have no owner session).
    if (this.teamLogin) {
      const email = this.teamLogin.accountEmail.toLowerCase();
      const seeded: Address = { email, domain: email.split("@")[1] ?? "" };
      runInAction(() => {
        this.availableAddresses = [seeded];
        this.enabledAccounts = [email];
        this.error = null;
      });
      writeEnabledAccounts(this.userId, [email]);
      writeAvailableAddresses(this.userId, [seeded]);
      this.ensureColors();
      return;
    }

    if (isPrimary) {
      runInAction(() => {
        this.error = null;
      });
    }

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
      const next = normalizeAddresses(data.addresses ?? []);
      runInAction(() => {
        this.availableAddresses = next;
        this.error = null;
      });
      writeAvailableAddresses(this.userId, next);
      this.pruneEnabledToAvailable();
      this.ensureColors();
    } catch (e) {
      // Keep the disk/memory catalog. Offline and 401 must not wipe accounts.
      if (isPrimary) {
        runInAction(() => {
          this.error = isPackagedApiUnavailableError(e)
            ? null
            : friendlyDesktopFetchError(e, "Failed to load addresses");
        });
      }
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

  /** Only after a successful network fetch (including authoritative empty). */
  private pruneEnabledToAvailable() {
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
