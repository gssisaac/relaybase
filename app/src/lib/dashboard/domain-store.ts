"use client";

import { makeAutoObservable, runInAction } from "mobx";

import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  defaultInboundEnabledByLocalPart,
} from "@/lib/dashboard/default-addresses";
import {
  desktopAwareFetch,
  friendlyDesktopFetchError,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api-base";

export {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  defaultInboundEnabledForLocalPart,
  suggestedDisplayNameForLocalPart,
} from "@/lib/dashboard/default-addresses";

export type OnboardingStepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed";

export type OnboardingOverallStatus =
  | "idle"
  | "running"
  | "waiting"
  | "ready"
  | "failed";

export type OnboardingFailureCode = "ZONE_NOT_FOUND" | "MX_CONFLICT";

export type MxConflictRecord = {
  id: string;
  name: string;
  content: string;
  priority: number | null;
};

export type DomainOnboardingStep = {
  id: string;
  label: string;
  status: OnboardingStepStatus;
  error?: string | null;
  errorCode?: OnboardingFailureCode | null;
  updatedAt?: string;
};

export type DomainOnboardingSummary = {
  status: OnboardingOverallStatus;
  currentStep: string | null;
  currentStepLabel: string | null;
  lastError: string | null;
  lastErrorCode: OnboardingFailureCode | null;
  zoneId: string | null;
  sendingSubdomainId: string | null;
  mxConflicts: MxConflictRecord[];
  steps: DomainOnboardingStep[];
};

export type DomainSummary = {
  domain: string;
  active: boolean;
  addressCount: number;
  audienceCount: number;
  broadcastCount: number;
  sentCount: number;
  r2Provisioned: boolean;
  r2BucketName: string | null;
  r2WorkerReady: boolean;
  onboarding: DomainOnboardingSummary | null;
};

export type DomainAddPhase =
  | "submitting"
  | "onboarding"
  | "seeding_addresses"
  | "done"
  | "failed";

export type DomainJobKind = "add" | "start" | "retry";

export type DomainAddJob = {
  id: string;
  domain: string;
  kind: DomainJobKind;
  seedDefaults: boolean;
  phase: DomainAddPhase;
  message: string | null;
  error: string | null;
  addressesAdded: string[];
  startedAt: number;
};

export type DomainProgressCard = {
  key: string;
  domain: string;
  title: string;
  description: string;
  status: "running" | "waiting" | "done" | "failed";
  onboarding: DomainOnboardingSummary | null;
  dismissible: boolean;
  jobId?: string;
};

const POLL_MS = 8000;
const DONE_DISMISS_MS = 10_000;
/** Long enough for R2 + Cloudflare steps; hung requests should not pin the banner forever. */
const REQUEST_TIMEOUT_MS = 180_000;

function timeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function timeoutErrorMessage(fallback: string, error: unknown): string {
  if (
    error instanceof DOMException &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  ) {
    return "Request timed out. Refresh domains — setup may still have finished.";
  }
  if (error instanceof Error && error.name === "TimeoutError") {
    return "Request timed out. Refresh domains — setup may still have finished.";
  }
  return friendlyDesktopFetchError(error, fallback);
}

async function postOnboard(
  domain: string,
  action: "start" | "advance" | "retry" | "resolve_mx_conflict",
): Promise<{
  domains: DomainSummary[];
  message: string;
}> {
  const res = await desktopAwareFetch("/api/email/domains/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, action }),
    signal: timeoutSignal(),
  });
  const data = await readResponseJson<{
    domains?: DomainSummary[];
    message?: string;
    error?: string;
  }>(res);
  if (!res.ok) throw new Error(data.error ?? "Onboarding request failed");
  return {
    domains: data.domains ?? [],
    message: data.message ?? "Onboarding updated",
  };
}

function needsPolling(domains: DomainSummary[]): boolean {
  return domains.some(
    (d) =>
      d.onboarding?.status === "running" || d.onboarding?.status === "waiting",
  );
}

function onboardingSettled(
  onboarding: DomainOnboardingSummary | null | undefined,
): "ready" | "failed" | null {
  if (!onboarding) return null;
  if (onboarding.status === "ready") return "ready";
  if (onboarding.status === "failed") return "failed";
  return null;
}

function isJobTerminal(job: DomainAddJob): boolean {
  return job.phase === "done" || job.phase === "failed";
}

export class DomainStore {
  domains: DomainSummary[] = [];
  loading = true;
  error: string | null = null;
  addJobs: DomainAddJob[] = [];

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private disposeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private waiters = new Map<
    string,
    Set<(result: "ready" | "failed") => void>
  >();
  private started = false;
  /** Serializes add/start/retry POSTs so concurrent imports do not race user data. */
  private submitTail: Promise<void> = Promise.resolve();
  /** Jobs whose ready→seed/dismiss path was taken by reconcile (not runJob). */
  private completingJobIds = new Set<string>();
  /** Bound by AccountsProvider — seeds via Dashboard AccountsStore + sync. */
  private seedAddressesFn:
    | ((domain: string) => Promise<string[]>)
    | null = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  bindSeedAddresses(fn: ((domain: string) => Promise<string[]>) | null) {
    this.seedAddressesFn = fn;
  }

  get hasProgress(): boolean {
    return this.progressCards.length > 0;
  }

  /** True while any add/onboarding job is still in flight (for sidebar spinner). */
  get isWorking(): boolean {
    return this.addJobs.some((j) => {
      if (j.phase === "done" || j.phase === "failed") return false;
      if (j.phase === "seeding_addresses") return true;
      const settled = onboardingSettled(
        this.domains.find((d) => d.domain === j.domain)?.onboarding,
      );
      // Server already settled — spinner should not wait on a hung submit.
      if (settled) return false;
      return true;
    });
  }

  get progressCards(): DomainProgressCard[] {
    const cards: DomainProgressCard[] = [];
    const jobDomains = new Set<string>();

    for (const job of this.addJobs) {
      jobDomains.add(job.domain);
      const summary = this.domains.find((d) => d.domain === job.domain);
      const onboarding = summary?.onboarding ?? null;
      // Prefer live domain status over a stuck in-flight job phase.
      const settled = onboardingSettled(onboarding);

      if (job.phase === "failed" || settled === "failed") {
        cards.push({
          key: job.id,
          domain: job.domain,
          title: job.domain,
          description:
            job.error ??
            onboarding?.lastError ??
            job.message ??
            "Domain setup failed",
          status: "failed",
          onboarding,
          dismissible: true,
          jobId: job.id,
        });
        continue;
      }

      if (job.phase === "done" || settled === "ready") {
        const seeding = job.phase === "seeding_addresses";
        cards.push({
          key: job.id,
          domain: job.domain,
          title: job.domain,
          description: seeding
            ? (job.message ?? "Adding standard addresses…")
            : job.phase === "done"
              ? (job.message ?? "Ready")
              : "Ready",
          status: seeding ? "running" : "done",
          onboarding,
          dismissible: !seeding,
          jobId: job.id,
        });
        continue;
      }

      if (job.phase === "submitting") {
        const submittingTitle =
          job.kind === "add"
            ? `Adding ${job.domain}`
            : job.kind === "retry"
              ? `Retrying ${job.domain}`
              : `Starting ${job.domain}`;
        cards.push({
          key: job.id,
          domain: job.domain,
          title: submittingTitle,
          description:
            job.message ??
            (job.kind === "add"
              ? "Starting domain provisioning…"
              : "Starting onboarding…"),
          status: "running",
          onboarding,
          dismissible: false,
          jobId: job.id,
        });
        continue;
      }

      if (job.phase === "seeding_addresses") {
        cards.push({
          key: job.id,
          domain: job.domain,
          title: job.domain,
          description:
            job.message ?? "Adding standard addresses (billing, support, …)",
          status: "running",
          onboarding,
          dismissible: false,
          jobId: job.id,
        });
        continue;
      }

      // onboarding
      const status =
        onboarding?.status === "waiting" ? "waiting" : "running";
      const stepLabel =
        onboarding?.currentStepLabel ??
        (status === "waiting" ? "Waiting for DNS" : "Provisioning");
      cards.push({
        key: job.id,
        domain: job.domain,
        title: job.domain,
        description:
          job.seedDefaults
            ? `${stepLabel} · standard addresses queued`
            : (job.message ?? stepLabel),
        status,
        onboarding,
        dismissible: false,
        jobId: job.id,
      });
    }

    for (const entry of this.domains) {
      if (jobDomains.has(entry.domain)) continue;
      const status = entry.onboarding?.status;
      if (status !== "running" && status !== "waiting") continue;
      cards.push({
        key: `onboard:${entry.domain}`,
        domain: entry.domain,
        title: entry.domain,
        description:
          status === "waiting"
            ? "Waiting for DNS"
            : (entry.onboarding?.currentStepLabel ?? "Provisioning"),
        status,
        onboarding: entry.onboarding,
        dismissible: false,
      });
    }

    return cards;
  }

  async start() {
    this.started = true;
    await this.refresh();
    this.ensurePolling();
  }

  stop() {
    this.started = false;
    this.clearPolling();
    for (const timer of this.disposeTimers.values()) {
      clearTimeout(timer);
    }
    this.disposeTimers.clear();
    // Do not clear waiters/jobs — provider remount should resume; full page
    // unload drops the store instance entirely.
  }

  async refresh() {
    this.error = null;
    try {
      const res = await desktopAwareFetch("/api/email/domains", {
        cache: "no-store",
        signal: timeoutSignal(),
      });
      const data = await readResponseJson<{
        domains?: DomainSummary[];
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load domains");
      this.applyDomains(data.domains ?? [], { clearLoading: true });
    } catch (e) {
      runInAction(() => {
        // Packaged app has no Next /api — keep UI usable on disk/cache without a red banner.
        this.error = isPackagedApiUnavailableError(e)
          ? null
          : timeoutErrorMessage("Failed to load domains", e);
        this.loading = false;
      });
    }
  }

  async addDomain(domain: string) {
    this.error = null;
    try {
      const res = await desktopAwareFetch("/api/email/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
        signal: timeoutSignal(),
      });
      const data = await readResponseJson<{
        domains?: DomainSummary[];
        message?: string;
        error?: string;
      }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to add domain");
      this.applyDomains(data.domains ?? []);
      return { message: data.message ?? "Domain added" };
    } catch (e) {
      throw new Error(timeoutErrorMessage("Failed to add domain", e));
    }
  }

  /**
   * Queue a background domain add. Returns immediately — dialog should close.
   * Onboarding (and optional default addresses) continue in the store.
   */
  queueAddDomain(domain: string, seedDefaults = true): DomainAddJob {
    return this.enqueueJob({
      domain,
      kind: "add",
      seedDefaults,
      phase: "submitting",
      message: `Adding ${domain.trim().toLowerCase()}…`,
    });
  }

  /** Queue several domains at once; returns immediately for background processing. */
  queueAddDomains(domains: string[], seedDefaults = true): DomainAddJob[] {
    return domains.map((domain) => this.queueAddDomain(domain, seedDefaults));
  }

  /** Start onboarding in the background; progress stays in the store across routes. */
  queueStartOnboarding(domain: string, seedDefaults = false): DomainAddJob {
    return this.enqueueJob({
      domain,
      kind: "start",
      seedDefaults,
      phase: "submitting",
      message: `Starting onboarding for ${domain.trim().toLowerCase()}…`,
    });
  }

  /** Retry failed onboarding in the background. */
  queueRetryOnboarding(domain: string, seedDefaults = false): DomainAddJob {
    return this.enqueueJob({
      domain,
      kind: "retry",
      seedDefaults,
      phase: "submitting",
      message: `Retrying onboarding for ${domain.trim().toLowerCase()}…`,
    });
  }

  dismissJob(jobId: string) {
    const timer = this.disposeTimers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.disposeTimers.delete(jobId);
    }
    this.addJobs = this.addJobs.filter((j) => j.id !== jobId);
  }

  /** Dismiss every progress job (used by the banner X control). */
  dismissAllProgress() {
    const domains = this.addJobs.map((j) => j.domain);
    const ids = this.addJobs.map((j) => j.id);
    for (const id of ids) this.dismissJob(id);
    for (const domain of domains) this.waiters.delete(domain);
  }

  clearError() {
    this.error = null;
  }

  private enqueueJob(params: {
    domain: string;
    kind: DomainJobKind;
    seedDefaults: boolean;
    phase: DomainAddPhase;
    message: string;
  }): DomainAddJob {
    const normalized = params.domain.trim().toLowerCase();
    const existing = this.addJobs.find(
      (j) =>
        j.domain === normalized &&
        j.phase !== "done" &&
        j.phase !== "failed",
    );
    if (existing) return existing;

    const job: DomainAddJob = {
      id: `${params.kind}-${normalized}-${Date.now()}`,
      domain: normalized,
      kind: params.kind,
      seedDefaults: params.seedDefaults,
      phase: params.phase,
      message: params.message,
      error: null,
      addressesAdded: [],
      startedAt: Date.now(),
    };
    this.addJobs.push(job);
    // Serialize heavy add/start/retry POSTs only; DNS waits may overlap after.
    void this.enqueueSubmit(job);
    this.ensurePolling();
    return job;
  }

  private enqueueSubmit(job: DomainAddJob) {
    this.submitTail = this.submitTail
      .then(() => this.runJob(job))
      .catch(() => undefined);
  }

  private applyDomains(
    domains: DomainSummary[],
    opts?: { clearLoading?: boolean },
  ) {
    runInAction(() => {
      this.domains = domains;
      if (opts?.clearLoading) this.loading = false;
    });
    this.resolveWaiters();
    this.reconcileJobsFromDomains();
    this.ensurePolling();
  }

  /**
   * When the domains list already shows ready/failed but a job is still
   * stuck in submitting/onboarding (hung HTTP), flip the job so the banner
   * can finish.
   */
  private reconcileJobsFromDomains() {
    for (const job of this.addJobs) {
      if (isJobTerminal(job) || job.phase === "seeding_addresses") continue;
      if (this.completingJobIds.has(job.id)) continue;

      const summary = this.domains.find((d) => d.domain === job.domain);
      const settled = onboardingSettled(summary?.onboarding);
      if (!settled) continue;

      if (settled === "failed") {
        runInAction(() => {
          job.phase = "failed";
          job.error =
            summary?.onboarding?.lastError ?? "Domain onboarding failed";
          job.message = job.error;
        });
        continue;
      }

      // ready — if submit HTTP is still in flight, finish without it
      if (job.phase === "submitting") {
        void this.completeJobFromReady(job);
      }
    }
  }

  private async completeJobFromReady(job: DomainAddJob) {
    if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;
    this.completingJobIds.add(job.id);
    try {
      if (job.seedDefaults) {
        runInAction(() => {
          job.phase = "seeding_addresses";
          job.message = "Adding standard addresses…";
        });
        const added = await this.seedDefaultAddresses(job.domain);
        if (job.phase !== "seeding_addresses") return;
        runInAction(() => {
          job.addressesAdded = added;
          job.phase = "done";
          job.message = `${job.domain} ready · added ${added.length} addresses`;
        });
        await this.refresh();
      } else {
        runInAction(() => {
          job.phase = "done";
          job.message = `${job.domain} ready`;
        });
      }
      this.scheduleDismiss(job.id);
    } catch (e) {
      if (isJobTerminal(job)) return;
      runInAction(() => {
        job.phase = "failed";
        job.error =
          e instanceof Error ? e.message : "Failed to add standard addresses";
        job.message = job.error;
      });
    } finally {
      this.completingJobIds.delete(job.id);
    }
  }

  async removeDomain(domain: string) {
    this.error = null;
    const res = await desktopAwareFetch(
      `/api/email/domains?domain=${encodeURIComponent(domain)}`,
      { method: "DELETE", signal: timeoutSignal() },
    );
    const data = await readResponseJson<{
      domains?: DomainSummary[];
      error?: string;
    }>(res);
    if (!res.ok) throw new Error(data.error ?? "Failed to remove domain");
    runInAction(() => {
      this.addJobs = this.addJobs.filter((j) => j.domain !== domain);
    });
    this.applyDomains(data.domains ?? []);
  }

  async startOnboarding(domain: string) {
    this.error = null;
    try {
      const result = await postOnboard(domain, "start");
      this.applyDomains(result.domains);
      return { message: result.message };
    } catch (e) {
      throw new Error(timeoutErrorMessage("Onboarding failed", e));
    }
  }

  async advanceOnboarding(domain: string) {
    this.error = null;
    try {
      const result = await postOnboard(domain, "advance");
      this.applyDomains(result.domains);
      return { message: result.message };
    } catch (e) {
      throw new Error(timeoutErrorMessage("Onboarding failed", e));
    }
  }

  async retryOnboarding(domain: string) {
    this.error = null;
    try {
      const result = await postOnboard(domain, "retry");
      this.applyDomains(result.domains);
      return { message: result.message };
    } catch (e) {
      throw new Error(timeoutErrorMessage("Onboarding failed", e));
    }
  }

  /** Delete conflicting apex MX records, then continue Email Routing enable. */
  async resolveMxConflict(domain: string) {
    this.error = null;
    try {
      const result = await postOnboard(domain, "resolve_mx_conflict");
      this.applyDomains(result.domains);
      return { message: result.message };
    } catch (e) {
      throw new Error(timeoutErrorMessage("Failed to resolve MX conflict", e));
    }
  }

  private async runJob(job: DomainAddJob) {
    try {
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;

      let result: { message: string };
      if (job.kind === "add") {
        result = await this.addDomain(job.domain);
      } else if (job.kind === "start") {
        result = await this.startOnboarding(job.domain);
      } else {
        result = await this.retryOnboarding(job.domain);
      }

      // Reconcile may have already finished (or failed) this job while HTTP ran.
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;

      runInAction(() => {
        job.phase = "onboarding";
        job.message = result.message;
      });
      this.ensurePolling();
    } catch (e) {
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;
      runInAction(() => {
        job.phase = "failed";
        job.error = timeoutErrorMessage(
          job.kind === "add" ? "Failed to add domain" : "Onboarding failed",
          e,
        );
        job.message = job.error;
      });
      return;
    }

    // Continue outside the submit lock (caller awaits only up to here via
    // careful structuring — finishJob follows without blocking the queue).
    void this.finishJobAfterSubmit(job);
  }

  private async finishJobAfterSubmit(job: DomainAddJob) {
    try {
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;

      const settled = await this.waitForOnboarding(job.domain);
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;

      if (settled === "failed") {
        const summary = this.domains.find((d) => d.domain === job.domain);
        throw new Error(
          summary?.onboarding?.lastError ?? "Domain onboarding failed",
        );
      }

      if (job.seedDefaults) {
        runInAction(() => {
          job.phase = "seeding_addresses";
          job.message = "Adding standard addresses…";
        });
        const added = await this.seedDefaultAddresses(job.domain);
        if (isJobTerminal(job)) return;
        runInAction(() => {
          job.addressesAdded = added;
          job.phase = "done";
          job.message = `${job.domain} ready · added ${added.length} addresses`;
        });
        await this.refresh();
      } else {
        runInAction(() => {
          job.phase = "done";
          job.message = `${job.domain} ready`;
        });
      }

      this.scheduleDismiss(job.id);
    } catch (e) {
      if (isJobTerminal(job) || this.completingJobIds.has(job.id)) return;
      runInAction(() => {
        job.phase = "failed";
        job.error = timeoutErrorMessage("Onboarding failed", e);
        job.message = job.error;
      });
    }
  }

  private async seedDefaultAddresses(domain: string): Promise<string[]> {
    if (this.seedAddressesFn) {
      return this.seedAddressesFn(domain);
    }
    // Fallback when AccountsProvider is not mounted (should be rare).
    const res = await desktopAwareFetch(
      `/api/email/addresses?domain=${encodeURIComponent(domain)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localParts: [...DEFAULT_ADDRESS_LOCAL_PARTS],
          displayNames: { ...DEFAULT_ADDRESS_DISPLAY_NAMES },
          inboundEnabledByLocalPart: defaultInboundEnabledByLocalPart(
            DEFAULT_ADDRESS_LOCAL_PARTS,
          ),
        }),
      },
    );
    const data = await readResponseJson<{
      addresses?: { email: string; domain: string }[];
      error?: string;
    }>(res);
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to add standard addresses");
    }
    const { notifyAddressesChanged } = await import(
      "@/lib/dashboard/accounts-sync"
    );
    const emails = (data.addresses ?? []).map((a) => a.email);
    notifyAddressesChanged({ domain, emails });
    return emails;
  }

  private waitForOnboarding(domain: string): Promise<"ready" | "failed"> {
    const existing = this.domains.find((d) => d.domain === domain);
    const settled = onboardingSettled(existing?.onboarding);
    if (settled) return Promise.resolve(settled);

    return new Promise((resolve) => {
      let set = this.waiters.get(domain);
      if (!set) {
        set = new Set();
        this.waiters.set(domain, set);
      }
      set.add(resolve);
      this.ensurePolling();
    });
  }

  private resolveWaiters() {
    for (const [domain, set] of this.waiters) {
      const summary = this.domains.find((d) => d.domain === domain);
      const settled = onboardingSettled(summary?.onboarding);
      if (!settled) continue;
      this.waiters.delete(domain);
      for (const resolve of set) resolve(settled);
    }
  }

  private scheduleDismiss(jobId: string) {
    const existing = this.disposeTimers.get(jobId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.disposeTimers.delete(jobId);
      this.dismissJob(jobId);
    }, DONE_DISMISS_MS);
    this.disposeTimers.set(jobId, timer);
  }

  private jobsNeedPolling(): boolean {
    return (
      this.waiters.size > 0 ||
      this.addJobs.some(
        (j) =>
          j.phase === "onboarding" ||
          j.phase === "submitting" ||
          j.phase === "seeding_addresses",
      )
    );
  }

  private ensurePolling() {
    if (!needsPolling(this.domains) && !this.jobsNeedPolling()) {
      this.clearPolling();
      return;
    }
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
    void this.pollOnce();
  }

  private clearPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce() {
    if (this.pollInFlight) return;
    this.pollInFlight = true;
    try {
      const pending = this.domains.filter(
        (d) =>
          d.onboarding?.status === "running" ||
          d.onboarding?.status === "waiting",
      );

      if (pending.length > 0) {
        for (const entry of pending) {
          try {
            await this.advanceOnboarding(entry.domain);
          } catch {
            // Keep polling; next tick may recover.
          }
        }
        return;
      }

      // No runnable steps — refresh so hung submits can reconcile against
      // server-side ready/failed, and idle waiters are not stuck forever.
      if (this.jobsNeedPolling()) {
        try {
          await this.refresh();
        } catch {
          // Next tick may recover.
        }
        if (!needsPolling(this.domains) && !this.jobsNeedPolling()) {
          this.clearPolling();
        }
        return;
      }

      this.clearPolling();
    } finally {
      this.pollInFlight = false;
    }
  }
}
