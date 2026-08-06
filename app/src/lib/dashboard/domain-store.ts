"use client";

import { makeAutoObservable, runInAction } from "mobx";

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

export type OnboardingFailureCode = "ZONE_NOT_FOUND";

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
  steps: DomainOnboardingStep[];
};

export type ZoneConnectionStatus = {
  found: boolean;
  zoneId: string | null;
  status: string | null;
  nameServers: string[];
};

/** Zone missing is a normal "connect domain" state, not a hard failure. */
export function needsDomainConnect(
  onboarding: DomainOnboardingSummary | null | undefined,
): boolean {
  if (!onboarding) return false;
  if (onboarding.lastErrorCode === "ZONE_NOT_FOUND") return true;
  if (onboarding.status !== "failed") return false;
  const err = onboarding.lastError ?? "";
  if (err.includes("No Cloudflare zone found")) return true;
  return Boolean(
    onboarding.steps?.some(
      (step) =>
        step.id === "resolve_zone" &&
        (step.errorCode === "ZONE_NOT_FOUND" ||
          (step.status === "failed" &&
            (step.error ?? "").includes("No Cloudflare zone found"))),
    ),
  );
}

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

export const DEFAULT_ADDRESS_LOCAL_PARTS = [
  "billing",
  "support",
  "privacy",
  "noreply",
  "hello",
  "admin",
] as const;

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

async function postOnboard(
  domain: string,
  action: "start" | "advance" | "retry",
): Promise<{
  domains: DomainSummary[];
  activeDomain: string | null;
  message: string;
}> {
  const res = await fetch("/api/email/domains/onboard", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, action }),
  });
  const data = (await res.json()) as {
    domains?: DomainSummary[];
    activeDomain?: string | null;
    message?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? "Onboarding request failed");
  return {
    domains: data.domains ?? [],
    activeDomain: data.activeDomain ?? null,
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

export class DomainStore {
  domains: DomainSummary[] = [];
  activeDomain: string | null = null;
  loading = true;
  error: string | null = null;
  addJobs: DomainAddJob[] = [];
  /** Domain the "Connect domain" guide should open for (e.g. from the progress banner). */
  zoneGuideRequest: string | null = null;

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private disposeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private waiters = new Map<
    string,
    Set<(result: "ready" | "failed") => void>
  >();
  private started = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get hasProgress(): boolean {
    return this.progressCards.length > 0;
  }

  get progressCards(): DomainProgressCard[] {
    const cards: DomainProgressCard[] = [];
    const jobDomains = new Set<string>();

    for (const job of this.addJobs) {
      jobDomains.add(job.domain);
      const summary = this.domains.find((d) => d.domain === job.domain);
      const onboarding = summary?.onboarding ?? null;

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

      if (job.phase === "failed") {
        // Missing Cloudflare site is a normal connect step — don't banner it as Failed.
        if (needsDomainConnect(onboarding)) {
          continue;
        }
        cards.push({
          key: job.id,
          domain: job.domain,
          title: job.domain,
          description: job.error ?? job.message ?? "Domain setup failed",
          status: "failed",
          onboarding,
          dismissible: true,
          jobId: job.id,
        });
        continue;
      }

      if (job.phase === "done") {
        cards.push({
          key: job.id,
          domain: job.domain,
          title: job.domain,
          description: job.message ?? "Ready",
          status: "done",
          onboarding,
          dismissible: true,
          jobId: job.id,
        });
        continue;
      }

      // onboarding
      if (needsDomainConnect(onboarding)) {
        continue;
      }
      const status =
        onboarding?.status === "waiting"
          ? "waiting"
          : onboarding?.status === "failed"
            ? "failed"
            : "running";
      const stepLabel =
        onboarding?.currentStepLabel ??
        (status === "waiting" ? "Waiting for DNS" : "Provisioning");
      cards.push({
        key: job.id,
        domain: job.domain,
        title: job.domain,
        description:
          job.seedDefaults && status !== "failed"
            ? `${stepLabel} · standard addresses queued`
            : (job.message ?? stepLabel),
        status: status === "failed" ? "failed" : status,
        onboarding,
        dismissible: status === "failed",
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

  domainQuery(extra?: Record<string, string>): string {
    const params = new URLSearchParams();
    if (this.activeDomain) params.set("domain", this.activeDomain);
    if (extra) {
      for (const [key, value] of Object.entries(extra)) {
        if (value) params.set(key, value);
      }
    }
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  async refresh() {
    this.error = null;
    try {
      const res = await fetch("/api/email/domains", { cache: "no-store" });
      const data = (await res.json()) as {
        domains?: DomainSummary[];
        activeDomain?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load domains");
      runInAction(() => {
        this.domains = data.domains ?? [];
        this.activeDomain = data.activeDomain ?? null;
        this.loading = false;
      });
      this.resolveWaiters();
      this.ensurePolling();
    } catch (e) {
      runInAction(() => {
        this.error = e instanceof Error ? e.message : "Failed to load domains";
        this.loading = false;
      });
    }
  }

  async setActiveDomain(domain: string) {
    this.error = null;
    const res = await fetch("/api/email/domains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activeDomain: domain }),
    });
    const data = (await res.json()) as {
      domains?: DomainSummary[];
      activeDomain?: string | null;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to update domain");
    runInAction(() => {
      this.domains = data.domains ?? [];
      this.activeDomain = data.activeDomain ?? domain;
    });
  }

  async addDomain(domain: string) {
    this.error = null;
    const res = await fetch("/api/email/domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    });
    const data = (await res.json()) as {
      domains?: DomainSummary[];
      activeDomain?: string | null;
      message?: string;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to add domain");
    runInAction(() => {
      this.domains = data.domains ?? [];
      this.activeDomain = data.activeDomain ?? null;
    });
    this.ensurePolling();
    return { message: data.message ?? "Domain added" };
  }

  /**
   * Queue a background domain add. Returns immediately — dialog should close.
   * Onboarding (and optional default addresses) continue in the store.
   */
  queueAddDomain(domain: string, seedDefaults: boolean): DomainAddJob {
    return this.enqueueJob({
      domain,
      kind: "add",
      seedDefaults,
      phase: "submitting",
      message: `Adding ${domain.trim().toLowerCase()}…`,
    });
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
    void this.runJob(job);
    return job;
  }

  async removeDomain(domain: string) {
    this.error = null;
    const res = await fetch(
      `/api/email/domains?domain=${encodeURIComponent(domain)}`,
      { method: "DELETE" },
    );
    const data = (await res.json()) as {
      domains?: DomainSummary[];
      activeDomain?: string | null;
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to remove domain");
    runInAction(() => {
      this.domains = data.domains ?? [];
      this.activeDomain = data.activeDomain ?? null;
      this.addJobs = this.addJobs.filter((j) => j.domain !== domain);
    });
    this.ensurePolling();
  }

  async startOnboarding(domain: string) {
    this.error = null;
    const result = await postOnboard(domain, "start");
    runInAction(() => {
      this.domains = result.domains;
      this.activeDomain = result.activeDomain;
    });
    this.resolveWaiters();
    this.ensurePolling();
    return { message: result.message };
  }

  async advanceOnboarding(domain: string) {
    this.error = null;
    const result = await postOnboard(domain, "advance");
    runInAction(() => {
      this.domains = result.domains;
      this.activeDomain = result.activeDomain;
    });
    this.resolveWaiters();
    this.ensurePolling();
    return { message: result.message };
  }

  async retryOnboarding(domain: string) {
    this.error = null;
    const result = await postOnboard(domain, "retry");
    runInAction(() => {
      this.domains = result.domains;
      this.activeDomain = result.activeDomain;
    });
    this.resolveWaiters();
    this.ensurePolling();
    return { message: result.message };
  }

  /** Live Cloudflare zone lookup for the "Connect domain" guide — does not touch onboarding state. */
  async checkZoneStatus(domain: string): Promise<ZoneConnectionStatus> {
    const res = await fetch(
      `/api/email/domains/zone-status?domain=${encodeURIComponent(domain)}`,
      { cache: "no-store" },
    );
    const data = (await res.json()) as ZoneConnectionStatus & {
      error?: string;
    };
    if (!res.ok) throw new Error(data.error ?? "Failed to check domain status");
    return {
      found: Boolean(data.found),
      zoneId: data.zoneId ?? null,
      status: data.status ?? null,
      nameServers: data.nameServers ?? [],
    };
  }

  /** Ask the Domains page to open the "Connect domain" guide for this domain (e.g. from the progress banner). */
  requestZoneGuide(domain: string) {
    this.zoneGuideRequest = domain;
  }

  clearZoneGuideRequest() {
    this.zoneGuideRequest = null;
  }

  private async runJob(job: DomainAddJob) {
    try {
      let result: { message: string };
      if (job.kind === "add") {
        result = await this.addDomain(job.domain);
      } else if (job.kind === "start") {
        result = await this.startOnboarding(job.domain);
      } else {
        result = await this.retryOnboarding(job.domain);
      }

      runInAction(() => {
        job.phase = "onboarding";
        job.message = result.message;
      });
      this.ensurePolling();

      const settled = await this.waitForOnboarding(job.domain);
      if (settled === "failed") {
        const summary = this.domains.find((d) => d.domain === job.domain);
        if (needsDomainConnect(summary?.onboarding)) {
          // Normal connect-domain state — drop the job quietly (no Failed banner).
          runInAction(() => {
            this.addJobs = this.addJobs.filter((j) => j.id !== job.id);
          });
          return;
        }
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
      runInAction(() => {
        job.phase = "failed";
        job.error =
          e instanceof Error
            ? e.message
            : job.kind === "add"
              ? "Failed to add domain"
              : "Onboarding failed";
        job.message = job.error;
      });
    }
  }

  private async seedDefaultAddresses(domain: string): Promise<string[]> {
    const res = await fetch(
      `/api/email/addresses?domain=${encodeURIComponent(domain)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localParts: [...DEFAULT_ADDRESS_LOCAL_PARTS],
        }),
      },
    );
    const data = (await res.json()) as {
      addresses?: { email: string; domain: string }[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "Failed to add standard addresses");
    }
    return (data.addresses ?? []).map((a) => a.email);
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

  private ensurePolling() {
    const jobsWaiting = this.addJobs.some(
      (j) => j.phase === "onboarding" || j.phase === "submitting",
    );
    if (!needsPolling(this.domains) && !jobsWaiting && this.waiters.size === 0) {
      this.clearPolling();
      return;
    }
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_MS);
  }

  private clearPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async pollOnce() {
    const pending = this.domains.filter(
      (d) =>
        d.onboarding?.status === "running" ||
        d.onboarding?.status === "waiting",
    );
    if (pending.length === 0) {
      // Still waiting for a job whose domain may not be listed yet
      if (this.waiters.size === 0) {
        this.clearPolling();
      }
      return;
    }
    for (const entry of pending) {
      try {
        await this.advanceOnboarding(entry.domain);
      } catch {
        // Keep polling; next tick may recover.
      }
    }
  }
}
