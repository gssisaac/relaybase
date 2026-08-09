"use client";

import {
  desktopGetCacheJson,
  desktopSaveCacheJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

/** Dashboard API response cache → ~/.relaybase/cache/** (see docs/relaybase-home-storage.md). */

/** Re-fetch when cached data is older than this on render. */
export const DASHBOARD_CACHE_REFRESH_AFTER_MS = 60_000;

export type DashboardCacheEnvelope<T> = {
  fetchedAt: string;
  data: T;
};

function localKey(relativePath: string) {
  return `relaybase:cache:v1:${relativePath}`;
}

function readLocalJson<T>(relativePath: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localKey(relativePath));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeLocalJson(relativePath: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(localKey(relativePath), JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

async function readJson<T>(relativePath: string): Promise<T | null> {
  if (isDesktopRuntime()) {
    const remote = await desktopGetCacheJson(relativePath);
    if (remote != null) {
      writeLocalJson(relativePath, remote);
      return remote as T;
    }
    return readLocalJson<T>(relativePath);
  }
  return readLocalJson<T>(relativePath);
}

async function writeJson(relativePath: string, value: unknown): Promise<void> {
  if (isDesktopRuntime()) {
    await desktopSaveCacheJson(relativePath, value);
    writeLocalJson(relativePath, value);
    return;
  }
  writeLocalJson(relativePath, value);
}

function safeResource(resource: string): string {
  const cleaned = resource.trim().replace(/[^a-zA-Z0-9._%-]/g, "_");
  return cleaned || "default";
}

function resourceCachePath(resource: string) {
  return `dashboard/${safeResource(resource)}.json`;
}

function statsCachePath(range: string) {
  return resourceCachePath(`stats-${range}`);
}

function apiKeysCachePath(range: string) {
  return resourceCachePath(`api-keys-${range}`);
}

function addressesCachePath(domain: string) {
  return resourceCachePath(`addresses-${safeResource(domain)}`);
}

function accountCountsCachePath(domain: string) {
  return resourceCachePath(`account-counts-${safeResource(domain)}`);
}

function accountStatsCachePath(email: string, range: string) {
  return resourceCachePath(
    `account-stats-${safeResource(email)}-${safeResource(range)}`,
  );
}

function accountLogsCachePath(email: string, status: string) {
  return resourceCachePath(
    `account-logs-${safeResource(email)}-${safeResource(status)}`,
  );
}

export function dashboardCacheAgeMs(fetchedAt: string): number {
  const ts = new Date(fetchedAt).getTime();
  if (!Number.isFinite(ts)) return Number.POSITIVE_INFINITY;
  return Date.now() - ts;
}

export function dashboardCacheNeedsRefresh(fetchedAt: string): boolean {
  return dashboardCacheAgeMs(fetchedAt) >= DASHBOARD_CACHE_REFRESH_AFTER_MS;
}

export async function loadDashboardCache<T>(
  resource: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    resourceCachePath(resource),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveDashboardCache<T>(
  resource: string,
  data: T,
): Promise<void> {
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(resourceCachePath(resource), envelope);
}

export async function loadDashboardStatsCache<T>(
  range: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    statsCachePath(range),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveDashboardStatsCache<T>(
  range: string,
  data: T,
): Promise<void> {
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(statsCachePath(range), envelope);
}

export async function loadApiKeysCache<T>(
  range: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    apiKeysCachePath(range),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveApiKeysCache<T>(
  range: string,
  data: T,
): Promise<void> {
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(apiKeysCachePath(range), envelope);
}

export async function loadAddressesCache<T>(
  domain: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const key = domain.trim().toLowerCase();
  if (!key) return null;
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    addressesCachePath(key),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveAddressesCache<T>(
  domain: string,
  data: T,
): Promise<void> {
  const key = domain.trim().toLowerCase();
  if (!key) return;
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(addressesCachePath(key), envelope);
}

export async function loadAccountCountsCache<T>(
  domain: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const key = domain.trim().toLowerCase();
  if (!key) return null;
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    accountCountsCachePath(key),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveAccountCountsCache<T>(
  domain: string,
  data: T,
): Promise<void> {
  const key = domain.trim().toLowerCase();
  if (!key) return;
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(accountCountsCachePath(key), envelope);
}

export async function loadAccountStatsCache<T>(
  email: string,
  range: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    accountStatsCachePath(key, range),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveAccountStatsCache<T>(
  email: string,
  range: string,
  data: T,
): Promise<void> {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(accountStatsCachePath(key, range), envelope);
}

export async function loadAccountLogsCache<T>(
  email: string,
  status: string,
): Promise<DashboardCacheEnvelope<T> | null> {
  const key = email.trim().toLowerCase();
  if (!key) return null;
  const envelope = await readJson<DashboardCacheEnvelope<T>>(
    accountLogsCachePath(key, status),
  );
  if (!envelope?.fetchedAt || envelope.data == null) return null;
  return envelope;
}

export async function saveAccountLogsCache<T>(
  email: string,
  status: string,
  data: T,
): Promise<void> {
  const key = email.trim().toLowerCase();
  if (!key) return;
  const envelope: DashboardCacheEnvelope<T> = {
    fetchedAt: new Date().toISOString(),
    data,
  };
  await writeJson(accountLogsCachePath(key, status), envelope);
}
