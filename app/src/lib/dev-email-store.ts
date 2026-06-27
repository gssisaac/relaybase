import fs from "fs";
import path from "path";

import { cookies } from "next/headers";

import {
  findAuthTokenForUser,
  isValidAuthToken,
  issueAuthTokenForUser,
} from "@/lib/relaybase/auth-tokens";
import type { DomainR2ProvisionResult } from "@/lib/relaybase/provision-domain-r2";
import {
  readRelaybasePlatformConfig,
} from "@/lib/relaybase/provision-domain-r2";
import { inboundR2ObjectPrefix } from "@/lib/relaybase/r2-inbound";
import type { EmailConfig } from "@/relaybase-email/components/types";

export type DevEmailConfig = {
  /** @deprecated Legacy single domain — use domains[] + activeDomain */
  domain?: string;
  activeDomain: string | null;
  cloudflareConfigured: boolean;
  relaybaseConfigured: boolean;
  relaybaseAuthToken?: string;
};

export type DevAddress = { email: string; domain: string };

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
  subject: string;
  sentAt: string;
  domain: string;
};

export type DomainR2Record = {
  bucketName: string;
  objectPrefix: string;
  bucketCreated: boolean;
  workerReady: boolean;
  workerBucketName: string | null;
  provisionedAt: string;
};

export type DevUserEmailData = {
  config: DevEmailConfig;
  domains: string[];
  domainR2?: Record<string, DomainR2Record>;
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
};

function dataFile(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9@._-]/g, "_");
  return path.join(process.cwd(), "..", "data", "users", `${safe}.json`);
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
    return { email, domain };
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
    subject: entry.subject,
    sentAt: entry.sentAt,
    domain:
      normalizeDomain(entry.domain ?? "") ||
      entry.from.split("@")[1]?.toLowerCase() ||
      fallbackDomain,
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
    addresses,
    audience,
    broadcasts,
    sent,
  };
}

export function readUserEmailData(userId: string): DevUserEmailData {
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

export function writeUserEmailData(
  userId: string,
  data: DevUserEmailData,
): void {
  const file = dataFile(userId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
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
    };
  });
}

export function addUserDomain(userId: string, domainInput: string): DevUserEmailData {
  const domain = normalizeDomain(domainInput);
  if (!domain || isPlaceholderDomain(domain)) {
    throw new Error("A valid domain is required");
  }

  const data = readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    data.domains.push(domain);
    data.domains.sort();
  }
  if (!data.config.activeDomain) {
    data.config.activeDomain = domain;
  }
  writeUserEmailData(userId, data);
  return data;
}

export function removeUserDomain(userId: string, domainInput: string): DevUserEmailData {
  const domain = normalizeDomain(domainInput);
  const data = readUserEmailData(userId);
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

  const active = getActiveDomain(data);
  data.config.activeDomain = active;
  writeUserEmailData(userId, data);
  return data;
}

export function setActiveUserDomain(
  userId: string,
  domainInput: string,
): DevUserEmailData {
  const domain = normalizeDomain(domainInput);
  const data = readUserEmailData(userId);
  if (!data.domains.includes(domain)) {
    throw new Error("Domain not found");
  }
  data.config.activeDomain = domain;
  writeUserEmailData(userId, data);
  return data;
}

export function resolveUserDomain(userId: string): string | null {
  return getActiveDomain(readUserEmailData(userId));
}

export async function requireSessionUserId(): Promise<string> {
  const jar = await cookies();
  const userId = jar.get("relaybase_user")?.value?.trim();
  if (!userId) throw new Error("Not signed in");
  return userId;
}

export function ensureUserAuthToken(userId: string): string {
  const data = readUserEmailData(userId);
  const stored = data.config.relaybaseAuthToken?.trim() ?? "";

  if (stored && isValidAuthToken(stored)) {
    return stored;
  }

  const fromVault = findAuthTokenForUser(userId);
  const token = fromVault ?? issueAuthTokenForUser(userId);

  data.config.relaybaseAuthToken = token;
  data.config.relaybaseConfigured = true;
  writeUserEmailData(userId, data);
  return token;
}

export function markDomainR2Provisioned(
  userId: string,
  result: DomainR2ProvisionResult,
): DevUserEmailData {
  const data = readUserEmailData(userId);
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
  writeUserEmailData(userId, data);
  return data;
}

export function buildUserEmailConfig(userId: string): EmailConfig {
  const data = readUserEmailData(userId);
  const activeDomain = getActiveDomain(data);
  const domain = activeDomain ?? "";
  const authToken = data.config.relaybaseAuthToken?.trim() ?? "";
  const authConfigured = Boolean(authToken && isValidAuthToken(authToken));
  const r2 = activeDomain ? data.domainR2?.[activeDomain] : undefined;
  const platform = readRelaybasePlatformConfig();
  const inboundR2BucketName =
    r2?.bucketName ?? platform.inboundR2BucketName;
  const inboundR2WorkerBucketName = r2?.workerBucketName ?? null;
  const inboundR2WorkerReady = r2?.workerReady ?? false;
  const inboundR2BucketExists = Boolean(r2?.provisionedAt);
  const inboundR2WorkerConfigured = Boolean(platform.workerUrl);
  const inboundR2Mismatch = Boolean(
    inboundR2WorkerBucketName &&
      inboundR2BucketName &&
      inboundR2WorkerBucketName.toLowerCase() !==
        inboundR2BucketName.toLowerCase(),
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
    relaybaseConfigured: data.config.relaybaseConfigured || authConfigured,
    relaybaseAuthConfigured: authConfigured,
    cloudflareConfigured: data.config.cloudflareConfigured,
    relaybaseWorkerUrl: "",
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
