import fs from "fs";
import path from "path";

import { cookies } from "next/headers";

import { getRelaybaseAppKv } from "@/lib/cloudflare/kv";
import {
  findAuthTokenForUser,
  isValidAuthToken,
  issueAuthTokenForUser,
} from "@/lib/relaybase/auth-tokens";
import type { DomainR2ProvisionResult } from "@/lib/relaybase/provision-domain-r2";
import { readRelaybasePlatformConfig } from "@/lib/relaybase/provision-domain-r2";
import {
  inboundR2ObjectPrefix,
  resolveInboundR2BucketName,
  workerInboundR2BucketMismatch,
} from "@/lib/relaybase/r2-inbound";
import type { EmailConfig } from "@/email/components/types";

export type DevEmailConfig = {
  /** @deprecated Legacy single domain — use domains[] + activeDomain */
  domain?: string;
  activeDomain: string | null;
  cloudflareConfigured: boolean;
  relaybaseConfigured: boolean;
  relaybaseAuthToken?: string;
};

export type DevAddress = {
  email: string;
  domain: string;
  displayName?: string;
};

export type DevAudienceContact = {
  email: string;
  name?: string;
  domain: string;
};

export type DevBroadcast = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  domain: string;
};

export type DevSent = {
  id: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  bodyPreview?: string;
  sentAt: string;
  domain: string;
  messageId?: string;
};

export type DomainR2Record = {
  bucketName: string;
  objectPrefix: string;
  bucketCreated: boolean;
  workerReady: boolean;
  workerBucketName: string | null;
  provisionedAt: string;
};

export type OnboardingStepId =
  | "resolve_zone"
  | "inbound_r2"
  | "sending_onboard"
  | "sending_dns"
  | "sending_enabled"
  | "routing_enable"
  | "ready";

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

/** Structured failure reason so the UI can branch without string-matching errors. */
export type OnboardingFailureCode = "ZONE_NOT_FOUND";

export type DomainOnboardingStep = {
  id: OnboardingStepId;
  label: string;
  status: OnboardingStepStatus;
  error?: string | null;
  errorCode?: OnboardingFailureCode | null;
  updatedAt?: string;
};

export type DomainOnboardingRecord = {
  status: OnboardingOverallStatus;
  currentStep: OnboardingStepId | null;
  steps: DomainOnboardingStep[];
  zoneId?: string | null;
  sendingSubdomainId?: string | null;
  returnPathDomain?: string | null;
  lastError?: string | null;
  lastErrorCode?: OnboardingFailureCode | null;
  updatedAt: string;
};

export type DomainOnboardingSummary = {
  status: OnboardingOverallStatus;
  currentStep: OnboardingStepId | null;
  currentStepLabel: string | null;
  lastError: string | null;
  lastErrorCode: OnboardingFailureCode | null;
  zoneId: string | null;
  sendingSubdomainId: string | null;
  steps: DomainOnboardingStep[];
};

export type DevUserEmailData = {
  config: DevEmailConfig;
  domains: string[];
  domainR2?: Record<string, DomainR2Record>;
  domainOnboarding?: Record<string, DomainOnboardingRecord>;
  addresses: DevAddress[];
  audience: DevAudienceContact[];
  broadcasts: DevBroadcast[];
  sent: DevSent[];
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

function safeUserId(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9@._-]/g, "_");
}

function userDataKvKey(userId: string): string {
  return `userdata:${safeUserId(userId)}`;
}

function dataFile(userId: string): string {
  return path.join(process.cwd(), "..", "data", "users", `${safeUserId(userId)}.json`);
}

export const ONBOARDING_STEP_DEFS: Array<{
  id: OnboardingStepId;
  label: string;
}> = [
  { id: "resolve_zone", label: "Resolve Cloudflare zone" },
  { id: "inbound_r2", label: "Provision inbound R2" },
  { id: "sending_onboard", label: "Onboard Email Sending" },
  { id: "sending_dns", label: "Verify sending DNS" },
  { id: "sending_enabled", label: "Enable Email Sending" },
  { id: "routing_enable", label: "Enable Email Routing" },
  { id: "ready", label: "Ready" },
];

export function createInitialOnboardingRecord(): DomainOnboardingRecord {
  const now = new Date().toISOString();
  return {
    status: "running",
    currentStep: "resolve_zone",
    steps: ONBOARDING_STEP_DEFS.map((step) => ({
      id: step.id,
      label: step.label,
      status: "pending",
      error: null,
      errorCode: null,
      updatedAt: now,
    })),
    zoneId: null,
    sendingSubdomainId: null,
    returnPathDomain: null,
    lastError: null,
    lastErrorCode: null,
    updatedAt: now,
  };
}

export function summarizeOnboarding(
  record: DomainOnboardingRecord | undefined,
): DomainOnboardingSummary | null {
  if (!record) return null;
  const current = record.currentStep
    ? record.steps.find((s) => s.id === record.currentStep)
    : null;
  return {
    status: record.status,
    currentStep: record.currentStep,
    currentStepLabel: current?.label ?? null,
    lastError: record.lastError ?? null,
    lastErrorCode: record.lastErrorCode ?? null,
    zoneId: record.zoneId ?? null,
    sendingSubdomainId: record.sendingSubdomainId ?? null,
    steps: record.steps,
  };
}

function emptyData(): DevUserEmailData {
  return {
    config: {
      activeDomain: null,
      cloudflareConfigured: false,
      relaybaseConfigured: false,
    },
    domains: [],
    domainR2: {},
    domainOnboarding: {},
    addresses: [],
    audience: [],
    broadcasts: [],
    sent: [],
  };
}

export function normalizeDomain(value: string): string {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

function isPlaceholderDomain(domain: string): boolean {
  return !domain || domain === "example.com";
}

function legacyDomain(raw: Partial<DevUserEmailData>): string | null {
  const fromConfig = normalizeDomain(raw.config?.domain ?? "");
  if (!isPlaceholderDomain(fromConfig)) return fromConfig;
  const fromActive = normalizeDomain(raw.config?.activeDomain ?? "");
  if (!isPlaceholderDomain(fromActive)) return fromActive;
  return null;
}

function migrateUserData(raw: Partial<DevUserEmailData>): DevUserEmailData {
  const base = { ...emptyData(), ...raw };
  const config = { ...emptyData().config, ...base.config };
  const legacy = legacyDomain(base);

  let domains = (base.domains ?? [])
    .map(normalizeDomain)
    .filter((d) => !isPlaceholderDomain(d));

  if (legacy && !domains.includes(legacy)) {
    domains = [legacy, ...domains];
  }

  const fallbackDomain = domains[0] ?? legacy ?? "example.com";
  let activeDomain = normalizeDomain(config.activeDomain ?? "");
  if (isPlaceholderDomain(activeDomain)) {
    activeDomain = domains[0] ?? null;
  }
  if (activeDomain && !domains.includes(activeDomain)) {
    domains = [activeDomain, ...domains];
  }

  const addresses = (base.addresses ?? []).map((entry) => {
    const email = entry.email?.trim() ?? "";
    const domain =
      normalizeDomain(entry.domain ?? "") ||
      email.split("@")[1]?.toLowerCase() ||
      fallbackDomain;
    const displayName = entry.displayName?.trim() || undefined;
    return { email, domain, ...(displayName ? { displayName } : {}) };
  });

  const audience = (base.audience ?? []).map((entry) => ({
    email: entry.email,
    name: entry.name,
    domain: normalizeDomain(entry.domain ?? "") || fallbackDomain,
  }));

  const broadcasts = (base.broadcasts ?? []).map((entry) => ({
    id: entry.id,
    subject: entry.subject,
    status: entry.status,
    createdAt: entry.createdAt,
    domain: normalizeDomain(entry.domain ?? "") || fallbackDomain,
  }));

  const sent = (base.sent ?? []).map((entry) => ({
    id: entry.id,
    from: entry.from,
    to: entry.to,
    ...(entry.cc ? { cc: entry.cc } : {}),
    subject: entry.subject,
    ...(entry.bodyPreview ? { bodyPreview: entry.bodyPreview } : {}),
    sentAt: entry.sentAt,
    domain:
      normalizeDomain(entry.domain ?? "") ||
      entry.from.split("@")[1]?.toLowerCase() ||
      fallbackDomain,
    ...(entry.messageId ? { messageId: entry.messageId } : {}),
  }));

  return {
    config: {
      activeDomain: activeDomain || null,
      cloudflareConfigured: config.cloudflareConfigured ?? false,
      relaybaseConfigured: config.relaybaseConfigured ?? false,
      relaybaseAuthToken: config.relaybaseAuthToken,
    },
    domains,
    domainR2: base.domainR2 ?? {},
    domainOnboarding: base.domainOnboarding ?? {},
    addresses,
    audience,
    broadcasts,
    sent,
  };
}

function readUserEmailDataFromFs(userId: string): DevUserEmailData {
  const file = dataFile(userId);
  if (!fs.existsSync(file)) return emptyData();
  try {
    return migrateUserData(
      JSON.parse(fs.readFileSync(file, "utf8")) as Partial<DevUserEmailData>,
    );
  } catch {
    return emptyData();
  }
}

function userDataLooksEmpty(data: DevUserEmailData): boolean {
  return (
    data.domains.length === 0 &&
    data.addresses.length === 0 &&
    data.audience.length === 0 &&
    data.broadcasts.length === 0 &&
    data.sent.length === 0
  );
}

function mergeAuthToken(
  target: DevUserEmailData,
  source: DevUserEmailData,
): DevUserEmailData {
  const token = source.config.relaybaseAuthToken?.trim();
  if (!token || target.config.relaybaseAuthToken?.trim()) return target;
  return {
    ...target,
    config: {
      ...target.config,
      relaybaseAuthToken: token,
      relaybaseConfigured: true,
    },
  };
}

function writeUserEmailDataToFs(userId: string, payload: string): void {
  const file = dataFile(userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, payload, "utf8");
}

export async function readUserEmailData(userId: string): Promise<DevUserEmailData> {
  const kv = await getRelaybaseAppKv();
  const fromFs = readUserEmailDataFromFs(userId);

  if (kv) {
    const raw = await kv.get(userDataKvKey(userId), "text");
    if (raw !== null) {
      const fromKv = migrateUserData(
        JSON.parse(raw) as Partial<DevUserEmailData>,
      );
      // Local miniflare can hold an empty shell from first login. Prefer the
      // monorepo data/users copy for the response, but do not put it back into
      // KV — with remote bindings that would overwrite production userdata.
      if (userDataLooksEmpty(fromKv) && !userDataLooksEmpty(fromFs)) {
        return mergeAuthToken(fromFs, fromKv);
      }
      return fromKv;
    }
  }

  return fromFs;
}

export async function writeUserEmailData(
  userId: string,
  data: DevUserEmailData,
): Promise<void> {
  const payload = `${JSON.stringify(data, null, 2)}\n`;
  const kv = await getRelaybaseAppKv();
  if (kv) {
    await kv.put(userDataKvKey(userId), payload);
  }

  const dataRoot = path.join(process.cwd(), "..", "data");
  if (!kv || fs.existsSync(dataRoot)) {
    writeUserEmailDataToFs(userId, payload);
  }
}

export function getActiveDomain(data: DevUserEmailData): string | null {
  const active = normalizeDomain(data.config.activeDomain ?? "");
  if (active && data.domains.includes(active)) return active;
  return data.domains[0] ?? null;
}

export function resolveRequestDomain(
  request: Request,
  data: DevUserEmailData,
): string | null {
  const url = new URL(request.url);
  const requested = normalizeDomain(url.searchParams.get("domain") ?? "");
  if (requested) {
    if (!data.domains.includes(requested)) return null;
    return requested;
  }
  return getActiveDomain(data);
}

export function listDomainSummaries(data: DevUserEmailData): DomainSummary[] {
  const active = getActiveDomain(data);
  return data.domains.map((domain) => {
    const r2 = data.domainR2?.[domain];
    return {
      domain,
      active: domain === active,
      addressCount: data.addresses.filter((a) => a.domain === domain).length,
      audienceCount: data.audience.filter((a) => a.domain === domain).length,
      broadcastCount: data.broadcasts.filter((b) => b.domain === domain).length,
      sentCount: data.sent.filter((s) => s.domain === domain).length,
      r2Provisioned: Boolean(r2?.provisionedAt),
      r2BucketName: r2?.bucketName ?? null,
      r2WorkerReady: r2?.workerReady ?? false,
      onboarding: summarizeOnboarding(data.domainOnboarding?.[domain]),
    };
  });
}

export async function addUserDomain(
  userId: string,
  domainInput: string,
): Promise<DevUserEmailData> {
  const domain = normalizeDomain(domainInput);
  if (!domain || isPlaceholderDomain(domain)) {
    throw new Error("A valid domain is required");
  }

  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    data.domains.push(domain);
    data.domains.sort();
  }
  if (!data.config.activeDomain) {
    data.config.activeDomain = domain;
  }
  await writeUserEmailData(userId, data);
  return data;
}

export async function removeUserDomain(
  userId: string,
  domainInput: string,
): Promise<DevUserEmailData> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  data.domains = data.domains.filter((d) => d !== domain);
  data.addresses = data.addresses.filter((a) => a.domain !== domain);
  data.audience = data.audience.filter((a) => a.domain !== domain);
  data.broadcasts = data.broadcasts.filter((b) => b.domain !== domain);
  data.sent = data.sent.filter((s) => s.domain !== domain);
  if (data.domainR2?.[domain]) {
    const nextR2 = { ...data.domainR2 };
    delete nextR2[domain];
    data.domainR2 = nextR2;
  }
  if (data.domainOnboarding?.[domain]) {
    const nextOnboarding = { ...data.domainOnboarding };
    delete nextOnboarding[domain];
    data.domainOnboarding = nextOnboarding;
  }

  const active = getActiveDomain(data);
  data.config.activeDomain = active;
  await writeUserEmailData(userId, data);
  return data;
}

export async function getDomainOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardingRecord | null> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  return data.domainOnboarding?.[domain] ?? null;
}

export async function setDomainOnboarding(
  userId: string,
  domainInput: string,
  record: DomainOnboardingRecord,
): Promise<DevUserEmailData> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }
  data.domainOnboarding = {
    ...(data.domainOnboarding ?? {}),
    [domain]: {
      ...record,
      updatedAt: new Date().toISOString(),
    },
  };
  await writeUserEmailData(userId, data);
  return data;
}

export async function initDomainOnboarding(
  userId: string,
  domainInput: string,
): Promise<DomainOnboardingRecord> {
  const domain = normalizeDomain(domainInput);
  const record = createInitialOnboardingRecord();
  await setDomainOnboarding(userId, domain, record);
  return record;
}

export async function setActiveUserDomain(
  userId: string,
  domainInput: string,
): Promise<DevUserEmailData> {
  const domain = normalizeDomain(domainInput);
  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }
  data.config.activeDomain = domain;
  await writeUserEmailData(userId, data);
  return data;
}

export async function resolveUserDomain(userId: string): Promise<string | null> {
  const data = await readUserEmailData(userId);
  return getActiveDomain(data);
}

export async function requireSessionUserId(): Promise<string> {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export async function ensureUserAuthToken(userId: string): Promise<string> {
  const data = await readUserEmailData(userId);
  const stored = data.config.relaybaseAuthToken?.trim() ?? "";

  if (stored && (await isValidAuthToken(stored))) {
    return stored;
  }

  const fromVault = await findAuthTokenForUser(userId);
  const token = fromVault ?? (await issueAuthTokenForUser(userId));

  data.config.relaybaseAuthToken = token;
  data.config.relaybaseConfigured = true;
  await writeUserEmailData(userId, data);
  return token;
}

export async function markDomainR2Provisioned(
  userId: string,
  result: DomainR2ProvisionResult,
): Promise<DevUserEmailData> {
  const data = await readUserEmailData(userId);
  data.domainR2 = {
    ...(data.domainR2 ?? {}),
    [result.domain]: {
      bucketName: result.bucketName,
      objectPrefix: result.objectPrefix,
      bucketCreated: result.bucketCreated,
      workerReady: result.workerReady,
      workerBucketName: result.workerBucketName,
      provisionedAt: new Date().toISOString(),
    },
  };
  await writeUserEmailData(userId, data);
  return data;
}

export async function buildUserEmailConfig(userId: string): Promise<EmailConfig> {
  const data = await readUserEmailData(userId);
  const activeDomain = getActiveDomain(data);
  const domain = activeDomain ?? "";
  const authToken = data.config.relaybaseAuthToken?.trim() ?? "";
  const authConfigured = Boolean(authToken && (await isValidAuthToken(authToken)));
  const r2 = activeDomain ? data.domainR2?.[activeDomain] : undefined;
  const platform = await readRelaybasePlatformConfig();
  const inboundR2BucketName = resolveInboundR2BucketName(
    "relaybase",
    r2?.bucketName ?? platform.inboundR2BucketName,
  );
  const inboundR2WorkerBucketName = r2?.workerBucketName ?? null;
  const inboundR2WorkerReady = r2?.workerReady ?? false;
  const inboundR2BucketExists = Boolean(r2?.provisionedAt);
  const inboundR2WorkerConfigured = Boolean(platform.workerUrl);
  const inboundR2Mismatch = workerInboundR2BucketMismatch(
    inboundR2BucketName,
    inboundR2WorkerBucketName,
  );
  const inboundR2Configured = Boolean(
    inboundR2BucketExists &&
      inboundR2WorkerReady &&
      !inboundR2Mismatch,
  );

  return {
    emailDomain: domain,
    emailZoneId: "",
    relaybaseApiKey: "",
    relaybaseAuthToken: authToken,
    relaybaseKeyId: "",
    cloudflareAccountId: "",
    cloudflareApiToken: "",
    cloudflareDnsApiToken: "",
    cloudflareApiEmail: "",
    cloudflareGlobalApiKey: "",
    registeredAddresses: data.addresses
      .filter((a) => !activeDomain || a.domain === activeDomain)
      .map((a) => a.email),
    audienceContacts: data.audience.filter(
      (a) => !activeDomain || a.domain === activeDomain,
    ),
    broadcasts: data.broadcasts
      .filter((b) => !activeDomain || b.domain === activeDomain)
      .map((b) => ({
        id: b.id,
        subject: b.subject,
        body: "",
        from: "",
        createdAt: b.createdAt,
        recipientCount: 0,
        status: b.status,
      })),
    configured: authConfigured,
    relaybaseConfigured:
      data.config.relaybaseConfigured ||
      authConfigured ||
      Boolean(platform.workerUrl),
    relaybaseAuthConfigured: authConfigured,
    cloudflareConfigured:
      data.config.cloudflareConfigured || platform.cloudflareConfigured,
    relaybaseWorkerUrl: platform.workerUrl,
    credentialSource: "integration",
    usesIntegrationCredentials: true,
    domain,
    domains: data.domains,
    activeDomain,
    inboundR2BucketName,
    inboundR2ObjectPrefix: activeDomain
      ? r2?.objectPrefix ?? inboundR2ObjectPrefix(activeDomain)
      : undefined,
    inboundR2BucketExists,
    inboundR2WorkerConfigured,
    inboundR2WorkerReady,
    inboundR2WorkerBucketName,
    inboundR2Mismatch,
    inboundR2Configured,
  };
}

export function buildUserStats(
  data: DevUserEmailData,
  domain: string | null,
  range: "24h" | "7d" | "30d" = "7d",
) {
  const scoped = domain
    ? {
        addresses: data.addresses.filter((a) => a.domain === domain),
        audience: data.audience.filter((a) => a.domain === domain),
        broadcasts: data.broadcasts.filter((b) => b.domain === domain),
        sent: data.sent.filter((s) => s.domain === domain),
      }
    : {
        addresses: data.addresses,
        audience: data.audience,
        broadcasts: data.broadcasts,
        sent: data.sent,
      };

  const rangeMs =
    range === "24h"
      ? 24 * 60 * 60 * 1000
      : range === "30d"
        ? 30 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;
  const bucketCount = range === "24h" ? 24 : range === "30d" ? 30 : 7;
  const now = Date.now();
  const since = now - rangeMs;
  const bucketMs = rangeMs / bucketCount;

  const sentBuckets = Array.from({ length: bucketCount }, (_, index) => ({
    value: 0,
    label:
      range === "24h"
        ? `${index}h`
        : range === "30d"
          ? `D${index + 1}`
          : `D${index + 1}`,
  }));

  for (const entry of scoped.sent) {
    const ts = new Date(entry.sentAt).getTime();
    if (ts < since) continue;
    const index = Math.min(
      bucketCount - 1,
      Math.floor((ts - since) / bucketMs),
    );
    sentBuckets[index].value += 1;
  }

  return {
    domain,
    range,
    totals: {
      addresses: scoped.addresses.length,
      audience: scoped.audience.length,
      broadcasts: scoped.broadcasts.length,
      drafts: scoped.broadcasts.filter((b) => b.status === "draft").length,
      sent: scoped.sent.length,
    },
    series: {
      sent: sentBuckets,
    },
  };
}
