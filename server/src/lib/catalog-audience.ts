/**
 * Audience contacts + groups catalog (Worker KV).
 * Keys: srv:catalog:audience, srv:catalog:audience-groups
 */

import type {
  AudienceContact,
  AudienceDataSource,
  AudienceDataSourcePatch,
  AudienceGroup,
  AudienceGroupSummary,
  AudienceSyncRun,
} from "./catalog-types";
import { normalizeDomain } from "./catalog-store";

const AUDIENCE_KV_KEY = "srv:catalog:audience";
const GROUPS_KV_KEY = "srv:catalog:audience-groups";
const SYNC_HISTORY_LIMIT = 20;
const SYNC_WRITE_CHUNK = 50;
const DUE_GRACE_MS = 60_000;

export type AudienceCatalog = {
  contacts: AudienceContact[];
  groups: AudienceGroup[];
};

async function readJson<T>(kv: KVNamespace, key: string, fallback: T): Promise<T> {
  const raw = await kv.get(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readAudienceCatalog(
  kv: KVNamespace,
): Promise<AudienceCatalog> {
  const [contacts, groups] = await Promise.all([
    readJson<AudienceContact[]>(kv, AUDIENCE_KV_KEY, []),
    readJson<AudienceGroup[]>(kv, GROUPS_KV_KEY, []),
  ]);
  return {
    contacts: Array.isArray(contacts) ? contacts : [],
    groups: Array.isArray(groups) ? groups : [],
  };
}

export async function writeAudienceContacts(
  kv: KVNamespace,
  contacts: AudienceContact[],
): Promise<void> {
  await kv.put(AUDIENCE_KV_KEY, JSON.stringify(contacts));
}

export async function writeAudienceGroups(
  kv: KVNamespace,
  groups: AudienceGroup[],
): Promise<void> {
  await kv.put(GROUPS_KV_KEY, JSON.stringify(groups));
}

export async function writeAudienceCatalog(
  kv: KVNamespace,
  catalog: AudienceCatalog,
): Promise<void> {
  await Promise.all([
    writeAudienceContacts(kv, catalog.contacts),
    writeAudienceGroups(kv, catalog.groups),
  ]);
}

function summarizeGroup(
  catalog: AudienceCatalog,
  group: AudienceGroup,
): AudienceGroupSummary {
  return {
    ...group,
    contactCount: catalog.contacts.filter((c) => c.groupId === group.id).length,
  };
}

export function listGroupSummaries(
  catalog: AudienceCatalog,
): AudienceGroupSummary[] {
  return catalog.groups.map((g) => summarizeGroup(catalog, g));
}

export function getGroupDetail(
  catalog: AudienceCatalog,
  groupId: string,
): { group: AudienceGroupSummary; contacts: AudienceContact[] } | null {
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) return null;
  return {
    group: summarizeGroup(catalog, group),
    contacts: catalog.contacts.filter((c) => c.groupId === groupId),
  };
}

function normalizeDataSource(
  source: AudienceDataSource,
): AudienceDataSource {
  return {
    type: "generic_json",
    endpointUrl: source.endpointUrl.trim(),
    ...(source.credential?.trim()
      ? { credential: source.credential.trim() }
      : {}),
    ...(source.credentialHeader?.trim()
      ? { credentialHeader: source.credentialHeader.trim() }
      : {}),
  };
}

export function mergeDataSource(
  previous: AudienceDataSource | undefined,
  patch: AudienceDataSourcePatch,
): AudienceDataSource {
  const credential =
    patch.credential !== undefined && patch.credential.trim()
      ? patch.credential.trim()
      : previous?.credential;
  let credentialHeader = previous?.credentialHeader;
  if ("credentialHeader" in patch) {
    credentialHeader = patch.credentialHeader?.trim() || undefined;
  }
  return normalizeDataSource({
    type: "generic_json",
    endpointUrl: patch.endpointUrl,
    credential,
    credentialHeader,
  });
}

function parseCredentialHeaderValue(
  dataSource: AudienceDataSource,
): { header: string; value: string } | null {
  const credential = dataSource.credential?.trim();
  if (!credential) return null;
  const header = dataSource.credentialHeader?.trim() || "Authorization";
  if (header.toLowerCase() === "authorization") {
    const value = credential.toLowerCase().startsWith("bearer ")
      ? credential
      : `Bearer ${credential}`;
    return { header: "Authorization", value };
  }
  return { header, value: credential };
}

function extractRawContactList(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const obj = json as Record<string, unknown>;
  for (const key of ["contacts", "data", "items", "results"]) {
    if (Array.isArray(obj[key])) return obj[key] as unknown[];
  }
  return [];
}

function emailLocalPart(email: string): string {
  return email.split("@")[0] || email;
}

export async function fetchDataSourceContacts(
  dataSource: AudienceDataSource,
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
    contacts.push({ email, name: explicitName || emailLocalPart(email) });
  }
  return { contacts, skippedCount };
}

function pushSyncHistory(group: AudienceGroup, run: AudienceSyncRun) {
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

export type SyncResult = {
  ok: boolean;
  count: number;
  skippedCount: number;
  error?: string;
};

export async function syncAudienceGroup(
  kv: KVNamespace,
  groupId: string,
  options: { trigger?: "manual" | "cron" } = {},
): Promise<SyncResult> {
  const catalog = await readAudienceCatalog(kv);
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audience group not found");
  if (!group.dataSource) throw new Error("Audience group has no data source");

  const trigger = options.trigger ?? "manual";
  const startedAt = new Date().toISOString();
  const run: AudienceSyncRun = {
    id: crypto.randomUUID(),
    trigger,
    status: "running",
    phase: "fetching",
    startedAt,
    processedCount: 0,
    totalCount: 0,
  };
  group.syncProgress = run;
  await writeAudienceGroups(kv, catalog.groups);

  const persistProgress = async () => {
    await writeAudienceGroups(kv, catalog.groups);
  };

  try {
    const { contacts, skippedCount } = await fetchDataSourceContacts(
      group.dataSource,
    );
    run.phase = "parsing";
    run.totalCount = contacts.length;
    run.skippedCount = skippedCount;
    run.failedCount = skippedCount;
    await persistProgress();

    const keep = catalog.contacts.filter(
      (c) => !(c.groupId === groupId && c.source === "synced"),
    );
    const synced: AudienceContact[] = contacts.map((c) => ({
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
    await persistProgress();

    for (let i = 0; i < synced.length; i += SYNC_WRITE_CHUNK) {
      run.processedCount = Math.min(i + SYNC_WRITE_CHUNK, synced.length);
      run.estimatedRemainingMs = estimateRemainingMs(
        startedAt,
        run.processedCount,
        synced.length,
      );
      await persistProgress();
    }

    catalog.contacts = [...keep, ...synced];
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
    await writeAudienceCatalog(kv, catalog);
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
    await writeAudienceGroups(kv, catalog.groups);
    return { ok: false, count: 0, skippedCount: 0, error: message };
  }
}

export async function createAudienceGroup(
  kv: KVNamespace,
  input: {
    name: string;
    domain: string;
    dataSource?: AudienceDataSourcePatch;
    cronEnabled?: boolean;
    cronIntervalMinutes?: number;
  },
): Promise<AudienceGroup> {
  const name = input.name.trim();
  const domain = normalizeDomain(input.domain);
  if (!name) throw new Error("name is required");
  if (!domain) throw new Error("domain is required");

  const catalog = await readAudienceCatalog(kv);
  const group: AudienceGroup = {
    id: crypto.randomUUID(),
    name,
    domain,
    createdAt: new Date().toISOString(),
    cronEnabled: Boolean(input.cronEnabled),
    ...(input.cronIntervalMinutes
      ? { cronIntervalMinutes: input.cronIntervalMinutes }
      : {}),
    ...(input.dataSource
      ? { dataSource: mergeDataSource(undefined, input.dataSource) }
      : {}),
  };
  catalog.groups.unshift(group);
  await writeAudienceGroups(kv, catalog.groups);

  if (group.dataSource) {
    await syncAudienceGroup(kv, group.id, { trigger: "manual" });
    const refreshed = await readAudienceCatalog(kv);
    return refreshed.groups.find((g) => g.id === group.id) ?? group;
  }
  return group;
}

export async function updateAudienceGroup(
  kv: KVNamespace,
  groupId: string,
  patch: {
    name?: string;
    defaultFrom?: string | null;
    dataSource?: AudienceDataSourcePatch | null;
    cronEnabled?: boolean;
    cronIntervalMinutes?: number | null;
  },
): Promise<AudienceGroup> {
  const catalog = await readAudienceCatalog(kv);
  const index = catalog.groups.findIndex((g) => g.id === groupId);
  if (index < 0) throw new Error("Audience group not found");
  const current = catalog.groups[index]!;

  if (patch.name !== undefined) {
    const name = patch.name.trim();
    if (!name) throw new Error("name is required");
    current.name = name;
  }
  if (patch.defaultFrom !== undefined) {
    if (patch.defaultFrom === null || !patch.defaultFrom.trim()) {
      delete current.defaultFrom;
    } else {
      current.defaultFrom = patch.defaultFrom.trim().toLowerCase();
    }
  }
  if (patch.dataSource === null) {
    delete current.dataSource;
  } else if (patch.dataSource) {
    current.dataSource = mergeDataSource(current.dataSource, patch.dataSource);
  }
  if (patch.cronEnabled !== undefined) {
    current.cronEnabled = patch.cronEnabled;
  }
  if (patch.cronIntervalMinutes !== undefined) {
    if (patch.cronIntervalMinutes === null || patch.cronIntervalMinutes <= 0) {
      delete current.cronIntervalMinutes;
    } else {
      current.cronIntervalMinutes = patch.cronIntervalMinutes;
    }
  }

  catalog.groups[index] = current;
  await writeAudienceGroups(kv, catalog.groups);
  return current;
}

export async function deleteAudienceGroup(
  kv: KVNamespace,
  groupId: string,
): Promise<void> {
  const catalog = await readAudienceCatalog(kv);
  catalog.groups = catalog.groups.filter((g) => g.id !== groupId);
  catalog.contacts = catalog.contacts.filter((c) => c.groupId !== groupId);
  await writeAudienceCatalog(kv, catalog);

  // Strip groupId from broadcasts (lazy import to avoid cycle).
  const { readBroadcasts, writeBroadcasts } = await import(
    "./catalog-broadcasts"
  );
  const broadcasts = await readBroadcasts(kv);
  let changed = false;
  for (const b of broadcasts) {
    const next = b.groupIds.filter((id) => id !== groupId);
    if (next.length !== b.groupIds.length) {
      b.groupIds = next;
      changed = true;
    }
  }
  if (changed) await writeBroadcasts(kv, broadcasts);
}

export async function addManualContact(
  kv: KVNamespace,
  groupId: string,
  input: { email: string; name?: string },
): Promise<AudienceContact> {
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    throw new Error("A valid email is required");
  }
  const catalog = await readAudienceCatalog(kv);
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) throw new Error("Audience group not found");
  if (catalog.contacts.some((c) => c.groupId === groupId && c.email === email)) {
    throw new Error("Contact already exists in this group");
  }
  const contact: AudienceContact = {
    id: crypto.randomUUID(),
    email,
    name: input.name?.trim() || undefined,
    domain: group.domain,
    groupId,
    source: "manual",
    addedAt: new Date().toISOString(),
  };
  catalog.contacts.push(contact);
  await writeAudienceContacts(kv, catalog.contacts);
  return contact;
}

export async function removeContact(
  kv: KVNamespace,
  groupId: string,
  contactId: string,
): Promise<void> {
  const catalog = await readAudienceCatalog(kv);
  catalog.contacts = catalog.contacts.filter(
    (c) => !(c.groupId === groupId && c.id === contactId),
  );
  await writeAudienceContacts(kv, catalog.contacts);
}

export function listContactsForGroups(
  catalog: AudienceCatalog,
  groupIds: string[],
): AudienceContact[] {
  const wanted = new Set(groupIds);
  const seen = new Set<string>();
  const result: AudienceContact[] = [];
  for (const contact of catalog.contacts) {
    if (!wanted.has(contact.groupId)) continue;
    if (seen.has(contact.email)) continue;
    seen.add(contact.email);
    result.push(contact);
  }
  return result;
}

export function getGroupProgress(catalog: AudienceCatalog, groupId: string) {
  const group = catalog.groups.find((g) => g.id === groupId);
  if (!group) return null;
  let nextDueAt: string | null = null;
  if (
    group.cronEnabled &&
    group.cronIntervalMinutes &&
    group.cronIntervalMinutes > 0
  ) {
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

function isDue(group: AudienceGroup, now: number): boolean {
  if (!group.cronEnabled || !group.dataSource) return false;
  const interval = group.cronIntervalMinutes ?? 0;
  if (interval <= 0) return false;
  if (!group.lastSyncAt) return true;
  const elapsed = now - new Date(group.lastSyncAt).getTime();
  return elapsed >= interval * 60_000 - DUE_GRACE_MS;
}

/** Cron entry: sync every due group in the single catalog. */
export async function runAudienceCron(
  kv: KVNamespace,
): Promise<{ groupsSynced: number }> {
  const catalog = await readAudienceCatalog(kv);
  const now = Date.now();
  const due = catalog.groups.filter((g) => isDue(g, now));
  let groupsSynced = 0;
  for (const group of due) {
    try {
      await syncAudienceGroup(kv, group.id, { trigger: "cron" });
      groupsSynced++;
    } catch (error) {
      console.error("Audience cron sync failed", group.id, error);
    }
  }
  return { groupsSynced };
}
