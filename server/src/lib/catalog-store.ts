/** Domains + addresses for the desktop mail client (packaged app). */

const MAILBOX_KV_KEY = "srv:catalog:mailbox";

export type MailboxAddress = {
  email: string;
  domain: string;
  displayName?: string;
  /**
   * When false, Cloudflare Email Routing uses action `drop`.
   * Omit / true = receive via Worker. Missing on read ⇒ treat as true.
   */
  inboundEnabled?: boolean;
};

/** Persist only `false`; omit means receive-on. */
export function normalizeMailboxAddress(input: {
  email: string;
  domain: string;
  displayName?: string;
  inboundEnabled?: boolean;
}): MailboxAddress {
  const displayName =
    typeof input.displayName === "string" ? input.displayName.trim() : "";
  return {
    email: input.email.trim().toLowerCase(),
    domain: normalizeDomain(input.domain),
    ...(displayName ? { displayName } : {}),
    ...(input.inboundEnabled === false ? { inboundEnabled: false } : {}),
  };
}

export type MailboxData = {
  domains: string[];
  addresses: MailboxAddress[];
};

export type MailboxDomainSummary = {
  domain: string;
  active: boolean;
  addressCount: number;
  audienceCount: number;
  broadcastCount: number;
  sentCount: number;
  r2Provisioned: boolean;
  r2BucketName: string | null;
  r2WorkerReady: boolean;
  onboarding: {
    status: "ready";
    currentStep: null;
    currentStepLabel: null;
    lastError: null;
    lastErrorCode: null;
    zoneId: null;
    sendingSubdomainId: null;
    mxConflicts: [];
    steps: [];
  };
};

function emptyMailbox(): MailboxData {
  return { domains: [], addresses: [] };
}

export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, "");
}

export async function readMailbox(kv: KVNamespace): Promise<MailboxData> {
  const raw = await kv.get(MAILBOX_KV_KEY);
  if (!raw) return emptyMailbox();
  try {
    const parsed = JSON.parse(raw) as Partial<MailboxData>;
    const domains = Array.isArray(parsed.domains)
      ? [
          ...new Set(
            parsed.domains
              .filter((d): d is string => typeof d === "string")
              .map(normalizeDomain)
              .filter(Boolean),
          ),
        ].sort()
      : [];
    const addresses = Array.isArray(parsed.addresses)
      ? parsed.addresses
          .filter(
            (a): a is MailboxAddress =>
              !!a &&
              typeof a === "object" &&
              typeof a.email === "string" &&
              typeof a.domain === "string",
          )
          .map((a) =>
            normalizeMailboxAddress({
              email: a.email,
              domain: a.domain,
              displayName:
                typeof a.displayName === "string" ? a.displayName : undefined,
              inboundEnabled:
                a.inboundEnabled === false
                  ? false
                  : a.inboundEnabled === true
                    ? true
                    : undefined,
            }),
          )
      : [];
    return { domains, addresses };
  } catch {
    return emptyMailbox();
  }
}

export async function writeMailbox(
  kv: KVNamespace,
  data: MailboxData,
): Promise<void> {
  await kv.put(MAILBOX_KV_KEY, JSON.stringify(data));
}

export function listDomainSummaries(data: MailboxData): MailboxDomainSummary[] {
  return data.domains.map((domain) => ({
    domain,
    active: false,
    addressCount: data.addresses.filter((a) => a.domain === domain).length,
    audienceCount: 0,
    broadcastCount: 0,
    sentCount: 0,
    r2Provisioned: true,
    r2BucketName: null,
    r2WorkerReady: true,
    // Packaged desktop has no Next onboarding pipeline — mark ready so
    // DomainStore.waitForOnboarding resolves and can seed addresses.
    onboarding: {
      status: "ready" as const,
      currentStep: null,
      currentStepLabel: null,
      lastError: null,
      lastErrorCode: null,
      zoneId: null,
      sendingSubdomainId: null,
      mxConflicts: [] as [],
      steps: [] as [],
    },
  }));
}

export async function addDomain(
  kv: KVNamespace,
  domainInput: string,
): Promise<MailboxData> {
  const domain = normalizeDomain(domainInput);
  if (!domain || domain === "example.com") {
    throw new Error("A valid domain is required");
  }
  const data = await readMailbox(kv);
  if (!data.domains.includes(domain)) {
    data.domains.push(domain);
    data.domains.sort();
    await writeMailbox(kv, data);
  }
  return data;
}

export async function removeDomain(
  kv: KVNamespace,
  domainInput: string,
): Promise<MailboxData> {
  const domain = normalizeDomain(domainInput);
  const data = await readMailbox(kv);
  data.domains = data.domains.filter((d) => d !== domain);
  data.addresses = data.addresses.filter((a) => a.domain !== domain);
  await writeMailbox(kv, data);
  return data;
}

export async function upsertAddresses(
  kv: KVNamespace,
  domainInput: string,
  entries: Array<{
    email: string;
    displayName?: string;
    inboundEnabled?: boolean;
  }>,
): Promise<{ data: MailboxData; added: MailboxAddress[] }> {
  const domain = normalizeDomain(domainInput);
  const data = await readMailbox(kv);
  if (!data.domains.includes(domain)) {
    data.domains.push(domain);
    data.domains.sort();
  }
  const added: MailboxAddress[] = [];
  for (const entry of entries) {
    const email = entry.email.trim().toLowerCase();
    if (!email.endsWith(`@${domain}`)) continue;
    const idx = data.addresses.findIndex((a) => a.email === email);
    const prev = idx >= 0 ? data.addresses[idx]! : undefined;
    const displayName =
      entry.displayName !== undefined
        ? entry.displayName.trim()
        : (prev?.displayName ?? "");
    const inboundEnabled =
      typeof entry.inboundEnabled === "boolean"
        ? entry.inboundEnabled
        : prev?.inboundEnabled !== false;
    const next = normalizeMailboxAddress({
      email,
      domain,
      displayName: displayName || undefined,
      inboundEnabled,
    });
    if (idx >= 0) {
      data.addresses[idx] = next;
    } else {
      data.addresses.push(next);
    }
    added.push(next);
  }
  await writeMailbox(kv, data);
  return { data, added };
}

export async function removeAddress(
  kv: KVNamespace,
  emailInput: string,
): Promise<{ data: MailboxData; removed: MailboxAddress | null }> {
  const email = emailInput.trim().toLowerCase();
  const data = await readMailbox(kv);
  const removed = data.addresses.find((a) => a.email === email) ?? null;
  data.addresses = data.addresses.filter((a) => a.email !== email);
  await writeMailbox(kv, data);
  return { data, removed };
}
