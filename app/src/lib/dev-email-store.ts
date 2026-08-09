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
import { emailLocalPart } from "@/lib/audience-display";
import type { EmailConfig } from "@/email/components/types";

export type DevEmailConfig = {
  /** @deprecated Legacy single domain — use domains[] */
  domain?: string;
  /** @deprecated Unused for UI scoping — dashboard uses URL ?domain= */
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

export type AudienceDataSourceType = "generic_json";

export type DevAudienceDataSource = {
  type: AudienceDataSourceType;
  endpointUrl: string;
  /** API key / token value sent with each fetch. Stored as-is (same posture as webhook secrets). */
  credential?: string;
  /** Header name to send the credential under. Defaults to "Authorization" as "Bearer <credential>". */
  credentialHeader?: string;
};

export type AudienceDataSourcePatch = {
  type?: AudienceDataSourceType;
  endpointUrl: string;
  /** Omit or leave empty to keep the previously stored token. */
  credential?: string;
  /** Omit to keep previous; empty string clears (use default Authorization). */
  credentialHeader?: string;
};

export type AudienceSyncPhase =
  | "idle"
  | "fetching"
  | "parsing"
  | "writing"
  | "done";

export type AudienceSyncRunStatus = "running" | "success" | "error";

export type DevAudienceSyncRun = {
  id: string;
  trigger: "manual" | "cron";
  status: AudienceSyncRunStatus;
  phase: AudienceSyncPhase;
  startedAt: string;
  finishedAt?: string;
  /** Total contacts discovered from the endpoint (after parse). */
  totalCount?: number;
  /** Contacts applied so far during the write phase. */
  processedCount?: number;
  skippedCount?: number;
  successCount?: number;
  failedCount?: number;
  error?: string;
  /** Estimated remaining time in ms (null/undefined when unknown). */
  estimatedRemainingMs?: number;
};

export type DevAudienceGroup = {
  id: string;
  name: string;
  domain: string;
  createdAt: string;
  /** Default From address for broadcasts to this group (must be a sender on the group domain). */
  defaultFrom?: string;
  dataSource?: DevAudienceDataSource;
  cronEnabled?: boolean;
  cronIntervalMinutes?: number;
  lastSyncAt?: string;
  lastSyncStatus?: "success" | "error";
  lastSyncError?: string;
  lastSyncCount?: number;
  /** Live or most recent sync run (polled by the Progress tab). */
  syncProgress?: DevAudienceSyncRun;
  /** Completed sync runs, newest first (capped). */
  syncHistory?: DevAudienceSyncRun[];
};

export type DevAudienceContact = {
  id: string;
  email: string;
  name?: string;
  domain: string;
  groupId: string;
  source: "manual" | "synced";
  addedAt: string;
};

export type DevBroadcast = {
  id: string;
  subject: string;
  status: string;
  createdAt: string;
  domain: string;
  groupIds: string[];
  from?: string;
  body?: string;
  recipientCount?: number;
  sentAt?: string;
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
  inReplyTo?: string;
  references?: string;
  replyKey?: string;
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
export type OnboardingFailureCode = "ZONE_NOT_FOUND" | "MX_CONFLICT";

export type MxConflictRecord = {
  id: string;
  name: string;
  content: string;
  priority: number | null;
};

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
  /** Apex MX records that block Cloudflare Email Routing (external providers). */
  mxConflicts?: MxConflictRecord[];
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
  mxConflicts: MxConflictRecord[];
  steps: DomainOnboardingStep[];
};

export type DevUserEmailData = {
  config: DevEmailConfig;
  domains: string[];
  domainR2?: Record<string, DomainR2Record>;
  domainOnboarding?: Record<string, DomainOnboardingRecord>;
  addresses: DevAddress[];
  audience: DevAudienceContact[];
  audienceGroups: DevAudienceGroup[];
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
    mxConflicts: [],
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
    mxConflicts: record.mxConflicts ?? [],
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
    audienceGroups: [],
    broadcasts: [],
    sent: [],
  };
}

function defaultAudienceGroupId(domain: string): string {
  return `group:default:${domain}`;
}

function legacyAudienceContactId(domain: string, email: string): string {
  return `legacy:${domain}:${email.toLowerCase()}`;
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

  const now = new Date().toISOString();

  const groupsById = new Map<string, DevAudienceGroup>();
  for (const entry of base.audienceGroups ?? []) {
    const domain = normalizeDomain(entry.domain ?? "") || fallbackDomain;
    const rawSource = entry.dataSource;
    const dataSource =
      rawSource?.endpointUrl?.trim()
        ? normalizeAudienceDataSource(rawSource)
        : undefined;
    groupsById.set(entry.id, {
      id: entry.id,
      name: entry.name,
      domain,
      createdAt: entry.createdAt ?? now,
      defaultFrom: entry.defaultFrom?.trim().toLowerCase() || undefined,
      dataSource,
      cronEnabled: entry.cronEnabled ?? false,
      cronIntervalMinutes: entry.cronIntervalMinutes,
      lastSyncAt: entry.lastSyncAt,
      lastSyncStatus: entry.lastSyncStatus,
      lastSyncError: entry.lastSyncError,
      lastSyncCount: entry.lastSyncCount,
      syncProgress: entry.syncProgress,
      syncHistory: entry.syncHistory ?? [],
    });
  }

  const defaultGroupDomainsNeeded = new Set<string>();

  const audience = (base.audience ?? []).map((entry) => {
    const domain = normalizeDomain(entry.domain ?? "") || fallbackDomain;
    const email = entry.email;
    let groupId = entry.groupId;
    if (!groupId || !groupsById.has(groupId)) {
      groupId = defaultAudienceGroupId(domain);
      defaultGroupDomainsNeeded.add(domain);
    }
    return {
      id: entry.id || legacyAudienceContactId(domain, email),
      email,
      name: entry.name,
      domain,
      groupId,
      source: entry.source ?? "manual",
      addedAt: entry.addedAt ?? now,
    };
  });

  for (const domain of defaultGroupDomainsNeeded) {
    const id = defaultAudienceGroupId(domain);
    if (!groupsById.has(id)) {
      groupsById.set(id, {
        id,
        name: "Manual subscribers",
        domain,
        createdAt: now,
        cronEnabled: false,
      });
    }
  }

  const audienceGroups = Array.from(groupsById.values());

  const broadcasts = (base.broadcasts ?? []).map((entry) => ({
    id: entry.id,
    subject: entry.subject,
    status: entry.status,
    createdAt: entry.createdAt,
    domain: normalizeDomain(entry.domain ?? "") || fallbackDomain,
    groupIds: entry.groupIds ?? [],
    ...(entry.from ? { from: entry.from } : {}),
    ...(entry.body ? { body: entry.body } : {}),
    ...(entry.recipientCount != null
      ? { recipientCount: entry.recipientCount }
      : {}),
    ...(entry.sentAt ? { sentAt: entry.sentAt } : {}),
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
    audienceGroups,
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
    data.audienceGroups.length === 0 &&
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

/** First owned domain — not a persisted UI preference. */
export function getActiveDomain(data: DevUserEmailData): string | null {
  return data.domains[0] ?? null;
}

/** Require explicit `?domain=` owned by the user. No persisted-active fallback. */
export function resolveRequestDomain(
  request: Request,
  data: DevUserEmailData,
): string | null {
  const url = new URL(request.url);
  const requested = normalizeDomain(url.searchParams.get("domain") ?? "");
  if (!requested) return null;
  if (!data.domains.includes(requested)) return null;
  return requested;
}

export function listDomainSummaries(data: DevUserEmailData): DomainSummary[] {
  return data.domains.map((domain) => {
    const r2 = data.domainR2?.[domain];
    return {
      domain,
      active: false,
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
  const removedGroupIds = new Set(
    data.audienceGroups
      .filter((g) => g.domain === domain)
      .map((g) => g.id),
  );
  data.audienceGroups = data.audienceGroups.filter(
    (g) => g.domain !== domain,
  );
  data.broadcasts = data.broadcasts
    .filter((b) => b.domain !== domain)
    .map((b) => ({
      ...b,
      groupIds: b.groupIds.filter((id) => !removedGroupIds.has(id)),
    }));
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
  const domain = getActiveDomain(data) ?? "";
  const authToken = data.config.relaybaseAuthToken?.trim() ?? "";
  const authConfigured = Boolean(authToken && (await isValidAuthToken(authToken)));
  const r2 = domain ? data.domainR2?.[domain] : undefined;
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
    registeredAddresses: data.addresses.map((a) => a.email),
    audienceContacts: data.audience,
    broadcasts: data.broadcasts.map((b) => ({
      id: b.id,
      subject: b.subject,
      body: b.body ?? "",
      from: b.from ?? "",
      createdAt: b.createdAt,
      sentAt: b.sentAt,
      recipientCount: b.recipientCount ?? 0,
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
    activeDomain: null,
    inboundR2BucketName,
    inboundR2ObjectPrefix: domain
      ? r2?.objectPrefix ?? inboundR2ObjectPrefix(domain)
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
      audienceGroups: domain
        ? data.audienceGroups.filter((g) => g.domain === domain).length
        : data.audienceGroups.length,
      broadcasts: scoped.broadcasts.length,
      drafts: scoped.broadcasts.filter((b) => b.status === "draft").length,
      sent: scoped.sent.length,
    },
    series: {
      sent: sentBuckets,
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Audience groups + data sources                                         */
/* ---------------------------------------------------------------------- */

export type AudienceGroupSummary = DevAudienceGroup & { contactCount: number };

function summarizeAudienceGroup(
  data: DevUserEmailData,
  group: DevAudienceGroup,
): AudienceGroupSummary {
  return {
    ...group,
    contactCount: data.audience.filter((c) => c.groupId === group.id).length,
  };
}

/** KV-only read, no FS fallback — for use outside Next.js request context (e.g. Cron). */
export async function readUserEmailDataFromKv(
  kv: KVNamespace,
  userId: string,
): Promise<DevUserEmailData> {
  const raw = await kv.get(userDataKvKey(userId), "text");
  if (raw === null) return emptyData();
  return migrateUserData(JSON.parse(raw) as Partial<DevUserEmailData>);
}

/** KV-only write, no FS fallback — for use outside Next.js request context (e.g. Cron). */
export async function writeUserEmailDataToKv(
  kv: KVNamespace,
  userId: string,
  data: DevUserEmailData,
): Promise<void> {
  await kv.put(userDataKvKey(userId), `${JSON.stringify(data, null, 2)}\n`);
}

/** List all `userdata:*` keys, paginating through cursors. */
export async function listUserDataKeys(kv: KVNamespace): Promise<string[]> {
  const keys: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await kv.list({ prefix: "userdata:", cursor });
    keys.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

/** True when `value` looks like an HTTP header name, not an API token. */
function looksLikeCredentialHeaderName(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 48) return false;
  if (!/^[A-Za-z][\w-]*$/.test(v)) return false;
  const lower = v.toLowerCase();
  if (
    lower === "authorization" ||
    lower === "api-key" ||
    lower === "apikey" ||
    lower === "token" ||
    lower === "x-api-key" ||
    lower === "x-auth-token"
  ) {
    return true;
  }
  // Custom headers are usually short and hyphenated (e.g. X-Relaybase-Key)
  return v.includes("-") && v.length <= 40;
}

/**
 * Normalize a data-source config: move a token mistakenly stored in
 * `credentialHeader` into `credential`, and drop empty strings.
 */
export function normalizeAudienceDataSource(
  source: DevAudienceDataSource,
): DevAudienceDataSource {
  let credential = source.credential?.trim() || undefined;
  let credentialHeader = source.credentialHeader?.trim() || undefined;

  if (
    !credential &&
    credentialHeader &&
    !looksLikeCredentialHeaderName(credentialHeader)
  ) {
    credential = credentialHeader;
    credentialHeader = undefined;
  }

  return {
    type: "generic_json",
    endpointUrl: source.endpointUrl.trim(),
    ...(credential ? { credential } : {}),
    ...(credentialHeader ? { credentialHeader } : {}),
  };
}

/**
 * Merge a data-source patch onto the existing config.
 * Empty / omitted `credential` keeps the previously stored token so a save
 * after a blank password field cannot wipe auth.
 */
export function mergeAudienceDataSource(
  previous: DevAudienceDataSource | undefined,
  patch: AudienceDataSourcePatch,
): DevAudienceDataSource {
  const headerInPatch = Object.prototype.hasOwnProperty.call(
    patch,
    "credentialHeader",
  );

  return normalizeAudienceDataSource({
    type: "generic_json",
    endpointUrl: patch.endpointUrl,
    credential: patch.credential?.trim() || previous?.credential,
    credentialHeader: headerInPatch
      ? patch.credentialHeader?.trim() || undefined
      : previous?.credentialHeader,
  });
}

/**
 * Builds the outbound auth header for a data-source fetch.
 * Matches curl: `-H "Authorization: Bearer <token>"` by default.
 *
 * Also recovers the common UI mistake of pasting the token into the
 * "header name" field, and accepts credential values that already include
 * a `Bearer ` prefix or a full `Header: value` line.
 */
function parseCredentialHeaderValue(dataSource: DevAudienceDataSource): {
  header: string;
  value: string;
} | null {
  let credential = dataSource.credential?.trim() || "";
  let header = dataSource.credentialHeader?.trim() || "";

  // Token pasted into the header-name field (credential left empty).
  if (!credential && header && !looksLikeCredentialHeaderName(header)) {
    credential = header;
    header = "Authorization";
  }

  if (!credential) return null;
  if (!header) header = "Authorization";

  // Full "Authorization: Bearer …" (or any "Header: value") pasted as credential.
  const inline = credential.match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
  if (inline) {
    return { header: inline[1], value: inline[2].trim() };
  }

  if (header.toLowerCase() === "authorization") {
    const value = /^bearer\s+/i.test(credential)
      ? credential
      : `Bearer ${credential}`;
    return { header, value };
  }

  return { header, value: credential };
}

/**
 * Expected data-source body: a JSON array of `{ email, name? }` objects.
 * Also accepts a single wrapper object with one of those arrays under
 * `contacts` / `data` / `items` / `results` for convenience.
 */
function extractRawContactList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    for (const key of ["contacts", "data", "items", "results"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }
  throw new Error(
    'Endpoint JSON must be an array of contacts, e.g. [{ "email": "a@b.com", "name": "A" }]',
  );
}

/** Fetches + parses a data source endpoint. Pure — no KV, safe to call from Cron or a request. */
export async function fetchDataSourceContacts(
  dataSource: DevAudienceDataSource,
): Promise<{
  contacts: Array<{ email: string; name?: string }>;
  skippedCount: number;
}> {
  const auth = parseCredentialHeaderValue(dataSource);
  const headers: Record<string, string> = auth
    ? { [auth.header]: auth.value }
    : {};

  const res = await fetch(dataSource.endpointUrl, { headers });
  if (!res.ok) {
    throw new Error(`Endpoint returned ${res.status} ${res.statusText}`);
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Endpoint did not return valid JSON");
  }

  const rawList = extractRawContactList(json);
  let skippedCount = 0;
  const contacts: Array<{ email: string; name?: string }> = [];
  for (const entry of rawList) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      skippedCount++;
      continue;
    }
    const record = entry as Record<string, unknown>;
    const email =
      typeof record.email === "string" ? record.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) {
      skippedCount++;
      continue;
    }
    const explicitName =
      typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : undefined;
    // When the API omits `name`, use the local-part (before @) as display name.
    const name = explicitName || emailLocalPart(email);
    contacts.push({ email, name });
  }
  return { contacts, skippedCount };
}

export type SyncAudienceGroupResult = {
  ok: boolean;
  count: number;
  skippedCount: number;
  error?: string;
};

const SYNC_HISTORY_LIMIT = 20;
const SYNC_WRITE_CHUNK = 50;

function pushSyncHistory(group: DevAudienceGroup, run: DevAudienceSyncRun) {
  const history = group.syncHistory ?? [];
  group.syncHistory = [run, ...history].slice(0, SYNC_HISTORY_LIMIT);
}

function estimateRemainingMs(
  startedAt: string,
  processed: number,
  total: number,
): number | undefined {
  if (processed <= 0 || total <= 0 || processed >= total) return undefined;
  const elapsed = Date.now() - new Date(startedAt).getTime();
  if (elapsed <= 0) return undefined;
  const rate = processed / elapsed;
  if (rate <= 0) return undefined;
  return Math.round((total - processed) / rate);
}

export type SyncAudienceGroupOptions = {
  trigger?: "manual" | "cron";
  /** Persist intermediate progress so the Progress tab can poll mid-run. */
  onProgress?: (data: DevUserEmailData) => Promise<void>;
};

/**
 * Fetches the group's data source and replaces its `source: "synced"`
 * contacts in-place on `data` (manual contacts are untouched). Writes
 * live progress onto `group.syncProgress` and optionally persists via
 * `onProgress` between phases. Shared by manual refresh and Cron.
 */
export async function syncAudienceGroupInData(
  data: DevUserEmailData,
  groupId: string,
  options: SyncAudienceGroupOptions = {},
): Promise<SyncAudienceGroupResult> {
  const group = data.audienceGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audience group not found");
  if (!group.dataSource) throw new Error("Audience group has no data source");

  const trigger = options.trigger ?? "manual";
  const startedAt = new Date().toISOString();
  const run: DevAudienceSyncRun = {
    id: crypto.randomUUID(),
    trigger,
    status: "running",
    phase: "fetching",
    startedAt,
    processedCount: 0,
    totalCount: 0,
  };
  group.syncProgress = run;
  await options.onProgress?.(data);

  try {
    const { contacts, skippedCount } = await fetchDataSourceContacts(
      group.dataSource,
    );

    run.phase = "parsing";
    run.totalCount = contacts.length;
    run.skippedCount = skippedCount;
    run.failedCount = skippedCount;
    await options.onProgress?.(data);

    const keep = data.audience.filter(
      (c) => !(c.groupId === groupId && c.source === "synced"),
    );
    const synced: DevAudienceContact[] = contacts.map((c) => ({
      id: `synced:${groupId}:${c.email}`,
      email: c.email,
      name: c.name,
      domain: group.domain,
      groupId,
      source: "synced" as const,
      addedAt: startedAt,
    }));

    run.phase = "writing";
    run.processedCount = 0;
    await options.onProgress?.(data);

    const applied: DevAudienceContact[] = [];
    for (let i = 0; i < synced.length; i += SYNC_WRITE_CHUNK) {
      const chunk = synced.slice(i, i + SYNC_WRITE_CHUNK);
      applied.push(...chunk);
      run.processedCount = applied.length;
      run.estimatedRemainingMs = estimateRemainingMs(
        startedAt,
        applied.length,
        synced.length,
      );
      // Persist chunk progress without committing contacts until the end —
      // contacts are applied atomically below so a mid-fail doesn't leave a
      // half-written synced set. Progress counts still advance for the UI.
      await options.onProgress?.(data);
    }

    data.audience = [...keep, ...synced];
    const finishedAt = new Date().toISOString();
    run.phase = "done";
    run.status = "success";
    run.finishedAt = finishedAt;
    run.processedCount = synced.length;
    run.successCount = synced.length;
    run.estimatedRemainingMs = 0;
    group.lastSyncAt = finishedAt;
    group.lastSyncStatus = "success";
    group.lastSyncError = undefined;
    group.lastSyncCount = synced.length;
    group.syncProgress = run;
    pushSyncHistory(group, { ...run });
    await options.onProgress?.(data);
    return { ok: true, count: synced.length, skippedCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    const finishedAt = new Date().toISOString();
    run.phase = "done";
    run.status = "error";
    run.finishedAt = finishedAt;
    run.error = message;
    run.estimatedRemainingMs = 0;
    group.lastSyncAt = finishedAt;
    group.lastSyncStatus = "error";
    group.lastSyncError = message;
    group.syncProgress = run;
    pushSyncHistory(group, { ...run });
    await options.onProgress?.(data);
    return { ok: false, count: 0, skippedCount: 0, error: message };
  }
}

export async function listAudienceGroupSummaries(
  userId: string,
): Promise<AudienceGroupSummary[]> {
  const data = await readUserEmailData(userId);
  return data.audienceGroups.map((group) => summarizeAudienceGroup(data, group));
}

export async function getAudienceGroupDetail(
  userId: string,
  groupId: string,
): Promise<{ group: AudienceGroupSummary; contacts: DevAudienceContact[] } | null> {
  const data = await readUserEmailData(userId);
  const group = data.audienceGroups.find((g) => g.id === groupId);
  if (!group) return null;
  return {
    group: summarizeAudienceGroup(data, group),
    contacts: data.audience.filter((c) => c.groupId === groupId),
  };
}

export async function createAudienceGroup(
  userId: string,
  input: {
    name: string;
    domain: string;
    dataSource?: DevAudienceDataSource;
    cronEnabled?: boolean;
    cronIntervalMinutes?: number;
  },
): Promise<{ group: AudienceGroupSummary; syncResult?: SyncAudienceGroupResult }> {
  const domain = normalizeDomain(input.domain);
  const name = input.name.trim();
  if (!name) throw new Error("A name is required");
  if (!domain || isPlaceholderDomain(domain)) {
    throw new Error("A valid domain is required");
  }

  const data = await readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }

  const group: DevAudienceGroup = {
    id: crypto.randomUUID(),
    name,
    domain,
    createdAt: new Date().toISOString(),
    dataSource: input.dataSource
      ? normalizeAudienceDataSource(input.dataSource)
      : undefined,
    cronEnabled: input.cronEnabled ?? false,
    cronIntervalMinutes: input.cronIntervalMinutes,
  };
  data.audienceGroups.push(group);

  let syncResult: SyncAudienceGroupResult | undefined;
  if (group.dataSource) {
    syncResult = await syncAudienceGroupInData(data, group.id, {
      trigger: "manual",
      onProgress: async (d) => writeUserEmailData(userId, d),
    });
  }

  await writeUserEmailData(userId, data);
  return { group: summarizeAudienceGroup(data, group), syncResult };
}

export async function updateAudienceGroup(
  userId: string,
  groupId: string,
  patch: Partial<
    Pick<
      DevAudienceGroup,
      "name" | "cronEnabled" | "cronIntervalMinutes" | "defaultFrom"
    >
  > & {
    /** `null` explicitly clears the data source; omit the key to leave it untouched. */
    dataSource?: AudienceDataSourcePatch | null;
  },
): Promise<AudienceGroupSummary> {
  const data = await readUserEmailData(userId);
  const group = data.audienceGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audience group not found");
  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("A name is required");
    group.name = name;
  }
  if (patch.defaultFrom !== undefined) {
    const from = patch.defaultFrom?.trim().toLowerCase() || "";
    if (!from) {
      group.defaultFrom = undefined;
    } else {
      const address = data.addresses.find(
        (a) => a.email.toLowerCase() === from,
      );
      if (!address) throw new Error("Sender address not found");
      if (address.domain !== group.domain) {
        throw new Error("Sender must belong to this group's domain");
      }
      group.defaultFrom = from;
    }
  }
  if (patch.dataSource !== undefined) {
    group.dataSource =
      patch.dataSource === null
        ? undefined
        : mergeAudienceDataSource(group.dataSource, patch.dataSource);
  }
  if (patch.cronEnabled !== undefined) group.cronEnabled = patch.cronEnabled;
  if (patch.cronIntervalMinutes !== undefined) {
    group.cronIntervalMinutes = patch.cronIntervalMinutes;
  }
  await writeUserEmailData(userId, data);
  return summarizeAudienceGroup(data, group);
}

export async function deleteAudienceGroup(
  userId: string,
  groupId: string,
): Promise<void> {
  const data = await readUserEmailData(userId);
  data.audienceGroups = data.audienceGroups.filter((g) => g.id !== groupId);
  data.audience = data.audience.filter((c) => c.groupId !== groupId);
  data.broadcasts = data.broadcasts.map((b) => ({
    ...b,
    groupIds: b.groupIds.filter((id) => id !== groupId),
  }));
  await writeUserEmailData(userId, data);
}

export async function syncAudienceGroup(
  userId: string,
  groupId: string,
): Promise<{ group: AudienceGroupSummary } & SyncAudienceGroupResult> {
  const data = await readUserEmailData(userId);
  const result = await syncAudienceGroupInData(data, groupId, {
    trigger: "manual",
    onProgress: async (d) => writeUserEmailData(userId, d),
  });
  await writeUserEmailData(userId, data);
  const group = data.audienceGroups.find((g) => g.id === groupId)!;
  return { group: summarizeAudienceGroup(data, group), ...result };
}

export type AudienceGroupProgressResponse = {
  groupId: string;
  cronEnabled: boolean;
  cronIntervalMinutes?: number;
  nextDueAt: string | null;
  lastSyncAt?: string;
  progress: DevAudienceSyncRun | null;
  history: DevAudienceSyncRun[];
};

export async function getAudienceGroupProgress(
  userId: string,
  groupId: string,
): Promise<AudienceGroupProgressResponse | null> {
  const data = await readUserEmailData(userId);
  const group = data.audienceGroups.find((g) => g.id === groupId);
  if (!group) return null;

  let nextDueAt: string | null = null;
  if (group.cronEnabled && group.cronIntervalMinutes && group.cronIntervalMinutes > 0) {
    if (group.lastSyncAt) {
      nextDueAt = new Date(
        new Date(group.lastSyncAt).getTime() +
          group.cronIntervalMinutes * 60_000,
      ).toISOString();
    } else {
      nextDueAt = new Date().toISOString();
    }
  }

  return {
    groupId,
    cronEnabled: Boolean(group.cronEnabled),
    cronIntervalMinutes: group.cronIntervalMinutes,
    nextDueAt,
    lastSyncAt: group.lastSyncAt,
    progress: group.syncProgress ?? null,
    history: group.syncHistory ?? [],
  };
}

export async function addManualAudienceContact(
  userId: string,
  groupId: string,
  input: { email: string; name?: string },
): Promise<DevAudienceContact> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }
  const data = await readUserEmailData(userId);
  const group = data.audienceGroups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audience group not found");
  if (data.audience.some((c) => c.groupId === groupId && c.email === email)) {
    throw new Error("Contact already exists in this group");
  }
  const contact: DevAudienceContact = {
    id: crypto.randomUUID(),
    email,
    name: input.name?.trim() || undefined,
    domain: group.domain,
    groupId,
    source: "manual",
    addedAt: new Date().toISOString(),
  };
  data.audience.push(contact);
  await writeUserEmailData(userId, data);
  return contact;
}

export async function removeAudienceContact(
  userId: string,
  groupId: string,
  contactId: string,
): Promise<void> {
  const data = await readUserEmailData(userId);
  data.audience = data.audience.filter(
    (c) => !(c.groupId === groupId && c.id === contactId),
  );
  await writeUserEmailData(userId, data);
}

/** De-duplicated (by email) union of contacts across the given groups — used for broadcast sends. */
export function listContactsForGroups(
  data: DevUserEmailData,
  groupIds: string[],
): DevAudienceContact[] {
  const wanted = new Set(groupIds);
  const seen = new Set<string>();
  const result: DevAudienceContact[] = [];
  for (const contact of data.audience) {
    if (!wanted.has(contact.groupId)) continue;
    if (seen.has(contact.email)) continue;
    seen.add(contact.email);
    result.push(contact);
  }
  return result;
}

export type BroadcastDetail = {
  broadcast: DevBroadcast;
  groups: AudienceGroupSummary[];
  recipientCount: number;
};

function resolveBroadcastGroups(
  data: DevUserEmailData,
  groupIds: string[],
): DevAudienceGroup[] {
  const wanted = new Set(groupIds);
  return data.audienceGroups.filter((g) => wanted.has(g.id));
}

export async function getBroadcastDetail(
  userId: string,
  broadcastId: string,
): Promise<BroadcastDetail | null> {
  const data = await readUserEmailData(userId);
  const broadcast = data.broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast) return null;
  const groups = resolveBroadcastGroups(data, broadcast.groupIds).map((g) =>
    summarizeAudienceGroup(data, g),
  );
  const recipientCount =
    broadcast.recipientCount ??
    listContactsForGroups(data, broadcast.groupIds).length;
  return { broadcast, groups, recipientCount };
}

/**
 * Default From for a broadcast targeting these groups:
 * 1. First group's `defaultFrom` that is a real address on that group's domain
 * 2. Else first address on the first group's domain
 */
function resolveDefaultFromForGroups(
  data: DevUserEmailData,
  groups: DevAudienceGroup[],
): string | undefined {
  for (const group of groups) {
    const preferred = group.defaultFrom?.trim().toLowerCase();
    if (
      preferred &&
      data.addresses.some(
        (a) =>
          a.email.toLowerCase() === preferred && a.domain === group.domain,
      )
    ) {
      return preferred;
    }
  }
  const primaryDomain = groups[0]?.domain;
  if (!primaryDomain) return undefined;
  return (
    data.addresses.find((a) => a.domain === primaryDomain)?.email.toLowerCase() ||
    undefined
  );
}

export async function createBroadcastDraft(
  userId: string,
  input: {
    groupIds: string[];
    from?: string;
    subject?: string;
    body?: string;
  },
): Promise<DevBroadcast> {
  const groupIds = Array.from(new Set(input.groupIds.filter(Boolean)));
  if (groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }

  const data = await readUserEmailData(userId);
  const groups = resolveBroadcastGroups(data, groupIds);
  if (groups.length === 0) {
    throw new Error("Audience group(s) not found");
  }

  const from =
    input.from?.trim().toLowerCase() ||
    resolveDefaultFromForGroups(data, groups);
  const domain = from?.split("@")[1]?.toLowerCase() || groups[0].domain;
  const broadcast: DevBroadcast = {
    id: crypto.randomUUID(),
    subject: input.subject?.trim() || "",
    status: "draft",
    createdAt: new Date().toISOString(),
    domain,
    groupIds,
    ...(from ? { from } : {}),
    ...(input.body != null ? { body: input.body } : { body: "" }),
    recipientCount: listContactsForGroups(data, groupIds).length,
  };
  data.broadcasts.unshift(broadcast);
  await writeUserEmailData(userId, data);
  return broadcast;
}

export async function updateBroadcastDraft(
  userId: string,
  broadcastId: string,
  patch: {
    groupIds?: string[];
    from?: string | null;
    subject?: string;
    body?: string;
  },
): Promise<DevBroadcast> {
  const data = await readUserEmailData(userId);
  const index = data.broadcasts.findIndex((b) => b.id === broadcastId);
  if (index < 0) throw new Error("Broadcast not found");
  const current = data.broadcasts[index];
  if (current.status !== "draft") {
    throw new Error("Only draft broadcasts can be edited");
  }

  let groupIds = current.groupIds;
  if (patch.groupIds !== undefined) {
    groupIds = Array.from(new Set(patch.groupIds.filter(Boolean)));
    if (groupIds.length === 0) {
      throw new Error("Select at least one audience group");
    }
    const groups = resolveBroadcastGroups(data, groupIds);
    if (groups.length === 0) {
      throw new Error("Audience group(s) not found");
    }
  }

  const from =
    patch.from === undefined
      ? current.from
      : patch.from?.trim() || undefined;
  const subject =
    patch.subject === undefined ? current.subject : patch.subject;
  const body = patch.body === undefined ? current.body : patch.body;
  const domain =
    from?.split("@")[1]?.toLowerCase() ||
    resolveBroadcastGroups(data, groupIds)[0]?.domain ||
    current.domain;

  const updated: DevBroadcast = {
    ...current,
    groupIds,
    subject,
    domain,
    ...(from ? { from } : { from: undefined }),
    body,
    recipientCount: listContactsForGroups(data, groupIds).length,
  };
  // Drop undefined from so JSON stays clean
  if (!from) delete updated.from;

  data.broadcasts[index] = updated;
  await writeUserEmailData(userId, data);
  return updated;
}

export async function sendBroadcast(
  userId: string,
  broadcastId: string,
): Promise<DevBroadcast> {
  const data = await readUserEmailData(userId);
  const index = data.broadcasts.findIndex((b) => b.id === broadcastId);
  if (index < 0) throw new Error("Broadcast not found");
  const current = data.broadcasts[index];
  if (current.status !== "draft") {
    throw new Error("Broadcast was already sent");
  }
  if (!current.from?.trim()) {
    throw new Error("Choose a From address before broadcasting");
  }
  if (!current.subject?.trim()) {
    throw new Error("Add a subject before broadcasting");
  }
  if (current.groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }

  const recipients = listContactsForGroups(data, current.groupIds);
  const sent: DevBroadcast = {
    ...current,
    subject: current.subject.trim(),
    status: "sent",
    sentAt: new Date().toISOString(),
    recipientCount: recipients.length,
    domain:
      current.from.split("@")[1]?.toLowerCase() ||
      current.domain,
  };
  data.broadcasts[index] = sent;
  await writeUserEmailData(userId, data);
  return sent;
}
