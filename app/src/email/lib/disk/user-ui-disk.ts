"use client";

import {
  desktopGetMailJson,
  desktopSaveMailJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import {
  fetchAccountStateJson,
  saveAccountStateJson,
} from "@/mail-platform/account-state";

/**
 * Durable UI state under ~/.relaybase/mail/{userId}/ui/*.json
 *
 * Desktop: disk is the source of truth, mirrored to the Worker's
 * `account_state` table (best-effort) on write so web builds see the same
 * state. Web: the Worker is the source of truth; localStorage is a warm
 * local mirror only (see docs/desktop/home-storage.md and the storage/cache
 * migration plan for why — a browser-only mirror doesn't survive a cleared
 * cache or follow the user to a second device).
 */

const NAMESPACE = "ui";

function safeUserId(userId: string): string {
  const cleaned = userId.trim().replace(/[^a-zA-Z0-9._%-]/g, "_");
  return cleaned || "default";
}

function uiPath(userId: string, file: string) {
  return `${safeUserId(userId)}/ui/${file}`;
}

function localKey(relativePath: string) {
  return `relaybase:mail:v1:${relativePath}`;
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
  if (isDesktopRuntime()) return;
  try {
    localStorage.setItem(localKey(relativePath), JSON.stringify(value));
  } catch {
    // quota / private mode
  }
}

export async function readUiJson<T>(
  userId: string,
  file: string,
): Promise<T | null> {
  const relativePath = uiPath(userId, file);
  if (isDesktopRuntime()) {
    try {
      const remote = await desktopGetMailJson(relativePath);
      if (remote != null) {
        writeLocalJson(relativePath, remote);
        return remote as T;
      }
    } catch {
      // Empty / corrupt disk file — treat as miss.
    }
    // Disk miss: allow one-time migrate from legacy localhost localStorage.
    return readLocalJson<T>(relativePath);
  }
  // Web: the Worker is the source of truth.
  const remote = await fetchAccountStateJson<T>(NAMESPACE, file);
  if (remote != null) {
    writeLocalJson(relativePath, remote);
    return remote;
  }
  return readLocalJson<T>(relativePath);
}

export async function writeUiJson(
  userId: string,
  file: string,
  value: unknown,
): Promise<void> {
  const relativePath = uiPath(userId, file);
  if (isDesktopRuntime()) {
    // Disk first — do not treat localhost localStorage as durable.
    await desktopSaveMailJson(relativePath, value);
    writeLocalJson(relativePath, value);
    // Best-effort mirror so a web session for the same account sees this too.
    saveAccountStateJson(NAMESPACE, file, value).catch(() => {});
    return;
  }
  // Web: write the local mirror first (instant, survives a flaky network),
  // then the Worker (source of truth) — let failures propagate, callers
  // already `.catch()` their writes.
  writeLocalJson(relativePath, value);
  await saveAccountStateJson(NAMESPACE, file, value);
}

export const UI_FILES = {
  enabledAccounts: "enabled-accounts.json",
  availableAddresses: "available-addresses.json",
  sidebar: "sidebar.json",
  accounts: "accounts.json",
  read: "read.json",
  trash: "trash.json",
  composeContacts: "compose-contacts.json",
} as const;
