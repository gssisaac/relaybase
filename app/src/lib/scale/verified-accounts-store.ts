"use client";

import { makeAutoObservable, runInAction } from "mobx";

import { scaleAudienceApi } from "@/lib/scale/audience-api";
import {
  VerifiedDestinationApiError,
  verifiedDestinationApi,
  type CfVerifiedDestinationAddress,
} from "@/lib/scale/verified-destination-api";

export type VerificationStatus = "verified" | "pending" | "unverified";

const POLL_MS = 5_000;
const POLL_MAX_MS = 5 * 60_000;

export class VerifiedAccountsStore {
  accountId = "";
  destinationsByEmail = new Map<string, CfVerifiedDestinationAddress>();
  loadingDestinations = false;
  destinationError: string | null = null;
  lastRefreshedAt: number | null = null;

  /** email (lowercase) → poll startedAt */
  private pollingStartedAt = new Map<string, number>();
  private pollTimers = new Map<string, ReturnType<typeof setInterval>>();

  /** In-flight verification actions per email */
  actionEmail: string | null = null;
  actionPhase: "idle" | "adding_contact" | "requesting_cf" | "checking" = "idle";
  actionError: string | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  configure(input: { accountId?: string }) {
    const next = input.accountId?.trim() ?? "";
    if (next === this.accountId) return;
    this.accountId = next;
    this.destinationsByEmail.clear();
    this.stopAllPolling();
  }

  statusForEmail(email: string): VerificationStatus {
    const key = email.trim().toLowerCase();
    const row = this.destinationsByEmail.get(key);
    if (!row) return "unverified";
    if (row.verifiedAt || row.verified) return "verified";
    return "pending";
  }

  destinationForEmail(email: string): CfVerifiedDestinationAddress | undefined {
    return this.destinationsByEmail.get(email.trim().toLowerCase());
  }

  countsForEmails(emails: string[]): { verified: number; pending: number; unverified: number; total: number } {
    let verified = 0;
    let pending = 0;
    let unverified = 0;
    for (const raw of emails) {
      const status = this.statusForEmail(raw);
      if (status === "verified") verified += 1;
      else if (status === "pending") pending += 1;
      else unverified += 1;
    }
    return { verified, pending, unverified, total: emails.length };
  }

  isPolling(email: string): boolean {
    return this.pollTimers.has(email.trim().toLowerCase());
  }

  async refreshDestinations(): Promise<void> {
    this.loadingDestinations = true;
    this.destinationError = null;
    try {
      const rows = await verifiedDestinationApi.list(this.accountId || undefined);
      runInAction(() => {
        this.destinationsByEmail.clear();
        for (const row of rows) {
          const key = row.email.trim().toLowerCase();
          if (key) this.destinationsByEmail.set(key, row);
        }
        this.lastRefreshedAt = Date.now();
      });
    } catch (e) {
      runInAction(() => {
        this.destinationError =
          e instanceof VerifiedDestinationApiError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Could not load Cloudflare verified addresses";
      });
    } finally {
      runInAction(() => {
        this.loadingDestinations = false;
      });
    }
  }

  private upsertDestination(row: CfVerifiedDestinationAddress) {
    const key = row.email.trim().toLowerCase();
    if (key) this.destinationsByEmail.set(key, row);
  }

  async requestCloudflareVerification(email: string): Promise<VerificationStatus> {
    const key = email.trim().toLowerCase();
    this.actionEmail = key;
    this.actionPhase = "requesting_cf";
    this.actionError = null;
    try {
      try {
        const created = await verifiedDestinationApi.create(
          key,
          this.accountId || undefined,
        );
        this.upsertDestination(created);
      } catch (e) {
        if (e instanceof VerifiedDestinationApiError && e.code === "already_exists") {
          await this.refreshDestinations();
        } else if (e instanceof VerifiedDestinationApiError && e.code === "rate_limited") {
          throw e;
        } else {
          throw e;
        }
      }
      const status = this.statusForEmail(key);
      if (status === "pending") this.startPolling(key);
      return this.statusForEmail(key);
    } catch (e) {
      this.actionError =
        e instanceof VerifiedDestinationApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Verification request failed";
      throw e;
    } finally {
      runInAction(() => {
        this.actionPhase = "idle";
        this.actionEmail = null;
      });
    }
  }

  async checkVerificationNow(email: string): Promise<VerificationStatus> {
    const key = email.trim().toLowerCase();
    this.actionEmail = key;
    this.actionPhase = "checking";
    this.actionError = null;
    try {
      await this.refreshDestinations();
      const status = this.statusForEmail(key);
      if (status === "verified") this.stopPolling(key);
      return status;
    } finally {
      runInAction(() => {
        this.actionPhase = "idle";
        this.actionEmail = null;
      });
    }
  }

  /**
   * Add a Scale audience contact and start Cloudflare destination verification.
   */
  async addVerifiedAccount(input: {
    groupId: string;
    email: string;
    name?: string;
  }): Promise<{ contactId: string; verification: VerificationStatus }> {
    const email = input.email.trim().toLowerCase();
    this.actionEmail = email;
    this.actionPhase = "adding_contact";
    this.actionError = null;
    try {
      const { contact } = await scaleAudienceApi.addContact(input.groupId, {
        email,
        name: input.name?.trim() || undefined,
      });
      const verification = await this.requestCloudflareVerification(email);
      return { contactId: contact.id, verification };
    } catch (e) {
      this.actionError =
        e instanceof Error ? e.message : "Could not add verified account";
      throw e;
    } finally {
      runInAction(() => {
        if (this.actionPhase === "adding_contact") {
          this.actionPhase = "idle";
          this.actionEmail = null;
        }
      });
    }
  }

  startPolling(email: string, onVerified?: () => void) {
    const key = email.trim().toLowerCase();
    if (this.statusForEmail(key) === "verified") return;
    if (this.pollTimers.has(key)) return;

    this.pollingStartedAt.set(key, Date.now());
    const timer = setInterval(() => {
      void (async () => {
        const started = this.pollingStartedAt.get(key) ?? Date.now();
        if (Date.now() - started > POLL_MAX_MS) {
          this.stopPolling(key);
          return;
        }
        await this.refreshDestinations();
        if (this.statusForEmail(key) === "verified") {
          this.stopPolling(key);
          onVerified?.();
        }
      })();
    }, POLL_MS);
    this.pollTimers.set(key, timer);
  }

  stopPolling(email: string) {
    const key = email.trim().toLowerCase();
    const timer = this.pollTimers.get(key);
    if (timer) clearInterval(timer);
    this.pollTimers.delete(key);
    this.pollingStartedAt.delete(key);
  }

  stopAllPolling() {
    for (const key of [...this.pollTimers.keys()]) {
      this.stopPolling(key);
    }
  }

  dispose() {
    this.stopAllPolling();
  }
}
