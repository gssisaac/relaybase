import { CloudflareEmailClient } from "@/lib/cloudflare/email-client";
import {
  createInitialOnboardingRecord,
  getDomainOnboarding,
  initDomainOnboarding,
  listDomainSummaries,
  markDomainR2Provisioned,
  normalizeDomain,
  readUserEmailData,
  setDomainOnboarding,
  type DomainOnboardingRecord,
  type DomainOnboardingStep,
  type DomainSummary,
  type MxConflictRecord,
  type OnboardingFailureCode,
  type OnboardingStepId,
} from "@/lib/dev-email-store";
import {
  DomainProvisionError,
  platformNotConfiguredError,
} from "@/lib/relaybase/domain-provision-errors";
import {
  provisionDomainInboundR2,
  readRelaybasePlatformConfig,
} from "@/lib/relaybase/provision-domain-r2";

const STEP_ORDER: OnboardingStepId[] = [
  "resolve_zone",
  "inbound_r2",
  "sending_onboard",
  "sending_dns",
  "sending_enabled",
  "routing_enable",
  "ready",
];

function nowIso(): string {
  return new Date().toISOString();
}

function nextStepId(current: OnboardingStepId): OnboardingStepId | null {
  const index = STEP_ORDER.indexOf(current);
  if (index < 0 || index >= STEP_ORDER.length - 1) return null;
  return STEP_ORDER[index + 1] ?? null;
}

function updateStep(
  record: DomainOnboardingRecord,
  stepId: OnboardingStepId,
  patch: Partial<DomainOnboardingStep>,
): DomainOnboardingRecord {
  const updatedAt = nowIso();
  return {
    ...record,
    updatedAt,
    steps: record.steps.map((step) =>
      step.id === stepId
        ? { ...step, ...patch, updatedAt }
        : step,
    ),
  };
}

function markFailed(
  record: DomainOnboardingRecord,
  stepId: OnboardingStepId,
  error: string,
  code?: OnboardingFailureCode,
): DomainOnboardingRecord {
  return {
    ...updateStep(record, stepId, {
      status: "failed",
      error,
      errorCode: code ?? null,
    }),
    status: "failed",
    currentStep: stepId,
    lastError: error,
    lastErrorCode: code ?? null,
    updatedAt: nowIso(),
  };
}

function markWaiting(
  record: DomainOnboardingRecord,
  stepId: OnboardingStepId,
  message?: string,
): DomainOnboardingRecord {
  return {
    ...updateStep(record, stepId, {
      status: "waiting",
      error: message ?? null,
    }),
    status: "waiting",
    currentStep: stepId,
    lastError: message ?? null,
    updatedAt: nowIso(),
  };
}

function markSucceeded(
  record: DomainOnboardingRecord,
  stepId: OnboardingStepId,
): DomainOnboardingRecord {
  const next = nextStepId(stepId);
  let nextRecord = updateStep(record, stepId, {
    status: "succeeded",
    error: null,
  });
  if (!next) {
    return {
      ...nextRecord,
      status: "ready",
      currentStep: "ready",
      lastError: null,
      updatedAt: nowIso(),
    };
  }
  return {
    ...nextRecord,
    status: "running",
    currentStep: next,
    lastError: null,
    updatedAt: nowIso(),
  };
}

function findRunnableStep(
  record: DomainOnboardingRecord,
): OnboardingStepId | null {
  if (record.status === "ready") return null;
  if (record.status === "failed") return null;

  const current = record.currentStep ?? "resolve_zone";
  const step = record.steps.find((s) => s.id === current);
  if (!step) return current;

  if (
    step.status === "pending" ||
    step.status === "running" ||
    step.status === "waiting"
  ) {
    return current;
  }

  if (step.status === "succeeded") {
    return nextStepId(current);
  }

  return null;
}

async function createEmailClient(): Promise<CloudflareEmailClient> {
  const platform = await readRelaybasePlatformConfig();
  if (!platform.cloudflareConfigured) {
    throw platformNotConfiguredError();
  }
  return CloudflareEmailClient.create({
    accountId: platform.cloudflareAccountId,
    apiToken: platform.cloudflareApiToken,
  });
}

const MX_CONFLICT_MESSAGE =
  "Existing MX records point this domain to another mail provider (for example Google Workspace). Cloudflare Email Routing cannot share the apex MX with an external mail server. Delete the conflicting records to continue — inbound mail for this domain will stop using the previous provider.";

function normalizeDnsName(name: string): string {
  return name.replace(/\.$/, "").toLowerCase();
}

function isApexDnsName(name: string, domain: string): boolean {
  const normalized = normalizeDnsName(name);
  return normalized === normalizeDnsName(domain) || normalized === "@";
}

function isCloudflareRoutingMx(content: string): boolean {
  return normalizeDnsName(content).endsWith(".mx.cloudflare.net");
}

async function listApexMxConflicts(
  client: CloudflareEmailClient,
  zoneId: string,
  domain: string,
): Promise<MxConflictRecord[]> {
  const allMx = await client.listDnsRecords(zoneId, {
    type: "MX",
    perPage: 100,
  });

  return allMx
    .filter(
      (row) =>
        isApexDnsName(row.name, domain) && !isCloudflareRoutingMx(row.content),
    )
    .map((row) => ({
      id: row.id,
      name: row.name,
      content: row.content,
      priority: row.priority ?? null,
    }));
}

function matchSendingSubdomain(
  list: Awaited<ReturnType<CloudflareEmailClient["listSendingSubdomains"]>>,
  domain: string,
) {
  const normalized = domain.toLowerCase();
  return (
    list.find((item) => item.name.toLowerCase() === normalized) ??
    list.find(
      (item) =>
        item.name.toLowerCase() === normalized ||
        item.name.toLowerCase().endsWith(`.${normalized}`),
    ) ??
    null
  );
}

async function runStep(
  userId: string,
  domain: string,
  stepId: OnboardingStepId,
  record: DomainOnboardingRecord,
): Promise<DomainOnboardingRecord> {
  let next = updateStep(record, stepId, { status: "running", error: null });
  next = {
    ...next,
    status: "running",
    currentStep: stepId,
    lastError: null,
    updatedAt: nowIso(),
  };
  await setDomainOnboarding(userId, domain, next);

  try {
    switch (stepId) {
      case "resolve_zone": {
        const client = await createEmailClient();
        const zoneId = await client.resolveZoneId(domain);
        if (!zoneId) {
          return markFailed(
            next,
            stepId,
            `No Cloudflare zone found for ${domain}. Add the domain to your Cloudflare account, then refresh from Cloudflare and retry.`,
            "ZONE_NOT_FOUND",
          );
        }
        next = { ...next, zoneId };
        return markSucceeded(next, stepId);
      }

      case "inbound_r2": {
        const existing = (await readUserEmailData(userId)).domainR2?.[domain];
        if (existing?.provisionedAt) {
          return markSucceeded(next, stepId);
        }
        const r2 = await provisionDomainInboundR2(domain);
        await markDomainR2Provisioned(userId, r2);
        return markSucceeded(next, stepId);
      }

      case "sending_onboard": {
        const zoneId = next.zoneId;
        if (!zoneId) {
          return markFailed(
            next,
            stepId,
            "Missing zone ID. Retry from Resolve Cloudflare zone.",
          );
        }
        const client = await createEmailClient();
        const existing = matchSendingSubdomain(
          await client.listSendingSubdomains(zoneId),
          domain,
        );
        const subdomain =
          existing ?? (await client.createSendingSubdomain(zoneId, domain));
        if (!subdomain.id) {
          return markFailed(
            next,
            stepId,
            "Cloudflare did not return a sending subdomain id.",
          );
        }
        next = {
          ...next,
          sendingSubdomainId: subdomain.id,
          returnPathDomain: subdomain.returnPathDomain ?? null,
        };
        return markSucceeded(next, stepId);
      }

      case "sending_dns": {
        const zoneId = next.zoneId;
        const subdomainId = next.sendingSubdomainId;
        if (!zoneId || !subdomainId) {
          return markFailed(
            next,
            stepId,
            "Missing zone or sending subdomain. Retry onboarding.",
          );
        }
        const client = await createEmailClient();
        const dns = await client.getSendingSubdomainDns(zoneId, subdomainId);
        if (!dns.length) {
          return markWaiting(
            next,
            stepId,
            "Waiting for Cloudflare to publish Email Sending DNS records.",
          );
        }
        return markSucceeded(next, stepId);
      }

      case "sending_enabled": {
        const zoneId = next.zoneId;
        if (!zoneId) {
          return markFailed(next, stepId, "Missing zone ID. Retry onboarding.");
        }
        const client = await createEmailClient();
        const subdomain = matchSendingSubdomain(
          await client.listSendingSubdomains(zoneId),
          domain,
        );
        if (!subdomain) {
          return markFailed(
            next,
            stepId,
            "Sending subdomain not found. Retry Email Sending onboard.",
          );
        }
        next = {
          ...next,
          sendingSubdomainId: subdomain.id || next.sendingSubdomainId,
          returnPathDomain:
            subdomain.returnPathDomain ?? next.returnPathDomain ?? null,
        };
        if (!subdomain.enabled) {
          return markWaiting(
            next,
            stepId,
            "Waiting for Email Sending DNS verification. This usually takes a few minutes.",
          );
        }
        return markSucceeded(next, stepId);
      }

      case "routing_enable": {
        const zoneId = next.zoneId;
        if (!zoneId) {
          return markFailed(next, stepId, "Missing zone ID. Retry onboarding.");
        }
        const client = await createEmailClient();
        const conflicts = await listApexMxConflicts(client, zoneId, domain);
        if (conflicts.length > 0) {
          return {
            ...markFailed(next, stepId, MX_CONFLICT_MESSAGE, "MX_CONFLICT"),
            mxConflicts: conflicts,
          };
        }
        const settings = await client.getEmailRoutingSettings(zoneId);
        if (!settings.enabled) {
          await client.enableEmailRouting(zoneId);
        }
        return {
          ...markSucceeded(next, stepId),
          mxConflicts: [],
        };
      }

      case "ready": {
        return {
          ...updateStep(next, stepId, { status: "succeeded", error: null }),
          status: "ready",
          currentStep: "ready",
          lastError: null,
          updatedAt: nowIso(),
        };
      }

      default:
        return markFailed(next, stepId, `Unknown onboarding step: ${stepId}`);
    }
  } catch (error) {
    const message =
      error instanceof DomainProvisionError
        ? error.userMessage
        : error instanceof Error
          ? error.message
          : String(error);
    return markFailed(next, stepId, message);
  }
}

export type DomainOnboardResult = {
  domains: DomainSummary[];
  onboarding: DomainOnboardingRecord | null;
  message: string;
};

async function loadResult(
  userId: string,
  domain: string,
  onboarding: DomainOnboardingRecord | null,
  message: string,
): Promise<DomainOnboardResult> {
  const data = await readUserEmailData(userId);
  return {
    domains: listDomainSummaries(data),
    onboarding: onboarding ?? data.domainOnboarding?.[domain] ?? null,
    message,
  };
}

export async function startDomainOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardResult> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }

  await initDomainOnboarding(userId, domain);
  return advanceDomainOnboarding(userId, domain);
}

export async function advanceDomainOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardResult> {
  const domain = normalizeDomain(domainInput);
  let record = await getDomainOnboarding(userId, domain);
  if (!record) {
    record = await initDomainOnboarding(userId, domain);
  }

  if (record.status === "ready") {
    return loadResult(userId, domain, record, `${domain} is ready.`);
  }

  // Cap steps per advance so a request stays bounded.
  const maxSteps = STEP_ORDER.length;
  for (let i = 0; i < maxSteps; i++) {
    const stepId = findRunnableStep(record);
    if (!stepId) break;

    record = await runStep(userId, domain, stepId, record);
    await setDomainOnboarding(userId, domain, record);

    if (record.status === "waiting") {
      return loadResult(
        userId,
        domain,
        record,
        record.lastError ??
          `Waiting on ${record.currentStep ?? "DNS"} for ${domain}.`,
      );
    }
    if (record.status === "failed") {
      return loadResult(
        userId,
        domain,
        record,
        record.lastError ?? `Onboarding failed for ${domain}.`,
      );
    }
    if (record.status === "ready") {
      return loadResult(
        userId,
        domain,
        record,
        `${domain} onboarding complete. Email Sending is ready.`,
      );
    }
  }

  return loadResult(
    userId,
    domain,
    record,
    `Onboarding in progress for ${domain}.`,
  );
}

export async function retryDomainOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardResult> {
  const domain = normalizeDomain(domainInput);
  let record = await getDomainOnboarding(userId, domain);
  if (!record) {
    return startDomainOnboarding(userId, domain);
  }

  const currentStepId = record.currentStep;
  const failedStep =
    record.steps.find((s) => s.status === "failed") ??
    (currentStepId
      ? record.steps.find((s) => s.id === currentStepId)
      : null);

  if (!failedStep && record.status === "ready") {
    // Allow re-run from the top if user explicitly retries a ready domain.
    record = createInitialOnboardingRecord();
    await setDomainOnboarding(userId, domain, record);
    return advanceDomainOnboarding(userId, domain);
  }

  const stepId = failedStep?.id ?? record.currentStep ?? "resolve_zone";
  const resetAt = nowIso();
  record = {
    ...updateStep(record, stepId, {
      status: "pending",
      error: null,
      errorCode: null,
      updatedAt: resetAt,
    }),
    status: "running",
    currentStep: stepId,
    lastError: null,
    lastErrorCode: null,
    updatedAt: resetAt,
  };
  await setDomainOnboarding(userId, domain, record);
  return advanceDomainOnboarding(userId, domain);
}

/**
 * Delete conflicting apex MX records (external mail providers), then retry
 * Email Routing enable. Does not touch cf-bounce Sending MX.
 */
export async function resolveMxConflictOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardResult> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }

  let record = await getDomainOnboarding(userId, domain);
  if (!record?.zoneId) {
    throw new Error("Missing zone ID. Retry onboarding.");
  }

  const client = await createEmailClient();
  const conflicts = await listApexMxConflicts(client, record.zoneId, domain);
  for (const mx of conflicts) {
    await client.deleteDnsRecord(record.zoneId, mx.id);
  }

  const resetAt = nowIso();
  record = {
    ...updateStep(record, "routing_enable", {
      status: "pending",
      error: null,
      errorCode: null,
      updatedAt: resetAt,
    }),
    status: "running",
    currentStep: "routing_enable",
    lastError: null,
    lastErrorCode: null,
    mxConflicts: [],
    updatedAt: resetAt,
  };
  await setDomainOnboarding(userId, domain, record);
  return advanceDomainOnboarding(userId, domain);
}

export async function buildDomainStatusFromOnboarding(
  userId: string,
  domainInput: string,
) {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  const record = data.domainOnboarding?.[domain];
  const platform = await readRelaybasePlatformConfig();

  let sendingEnabled = false;
  let routingEnabled = false;
  let dnsRecords: Array<{
    type: string;
    name: string;
    expected: string;
    found: boolean;
  }> = [];

  if (
    platform.cloudflareConfigured &&
    record?.zoneId &&
    record.sendingSubdomainId
  ) {
    try {
      const client = CloudflareEmailClient.create({
        accountId: platform.cloudflareAccountId,
        apiToken: platform.cloudflareApiToken,
      });
      const subdomains = await client.listSendingSubdomains(record.zoneId);
      const subdomain = matchSendingSubdomain(subdomains, domain);
      sendingEnabled = subdomain?.enabled === true;

      const routing = await client.getEmailRoutingSettings(record.zoneId);
      routingEnabled = routing.enabled === true;

      const dns = await client.getSendingSubdomainDns(
        record.zoneId,
        record.sendingSubdomainId,
      );
      dnsRecords = dns.map((row) => ({
        type: row.type,
        name: row.name,
        expected: row.content,
        found: sendingEnabled,
      }));
    } catch {
      // Keep stored flags when live CF probe fails.
    }
  }

  const sendingOnboarded =
    record?.status === "ready" ||
    Boolean(
      record?.steps.find(
        (s) => s.id === "sending_onboard" && s.status === "succeeded",
      ),
    );

  return {
    domain,
    zoneId: record?.zoneId ?? null,
    cloudflareConfigured: platform.cloudflareConfigured,
    sendingOnboarded,
    sendingEnabled: sendingEnabled || record?.status === "ready",
    sendingDnsConfigured:
      Boolean(
        record?.steps.find(
          (s) => s.id === "sending_dns" && s.status === "succeeded",
        ),
      ) || sendingEnabled,
    routingEnabled:
      routingEnabled ||
      Boolean(
        record?.steps.find(
          (s) => s.id === "routing_enable" && s.status === "succeeded",
        ),
      ),
    sendingSubdomainId: record?.sendingSubdomainId ?? null,
    returnPathDomain: record?.returnPathDomain ?? null,
    cloudflareSendingUrl: record?.zoneId
      ? "https://dash.cloudflare.com/?to=/:account/email-service/sending"
      : null,
    dnsRecords,
    onboarding: record
      ? {
          status: record.status,
          currentStep: record.currentStep,
          lastError: record.lastError ?? null,
          lastErrorCode: record.lastErrorCode ?? null,
          mxConflicts: record.mxConflicts ?? [],
          steps: record.steps,
        }
      : null,
  };
}
