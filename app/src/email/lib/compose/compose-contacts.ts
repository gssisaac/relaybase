"use client";

import * as React from "react";

import { readUiJson, UI_FILES, writeUiJson } from "@/email/lib/disk/user-ui-disk";
import { parseRecipientToken } from "@/lib/email/parse-recipients";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";

const KEY_PREFIX = "relaybase:compose-contacts:";
const MAX_CONTACTS = 500;

export type ComposeContact = {
  email: string;
  displayName?: string;
  lastUsedAt: number;
};

export type ComposeContactEntry = {
  email: string;
  displayName?: string;
};

type ComposeContactsFile = {
  contacts?: unknown;
};

function composeContactsKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeContacts(raw: unknown): ComposeContact[] {
  if (!Array.isArray(raw)) return [];
  const out: ComposeContact[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const email =
      typeof record.email === "string" ? normalizeEmail(record.email) : "";
    if (!email) continue;
    const displayName =
      typeof record.displayName === "string" && record.displayName.trim()
        ? record.displayName.trim()
        : undefined;
    const lastUsedAt =
      typeof record.lastUsedAt === "number" && Number.isFinite(record.lastUsedAt)
        ? record.lastUsedAt
        : 0;
    out.push({ email, displayName, lastUsedAt });
  }
  return out;
}

function readLocalComposeContacts(userId: string): ComposeContact[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(composeContactsKey(userId));
    if (!raw) return [];
    return normalizeContacts(JSON.parse(raw) as ComposeContactsFile["contacts"]);
  } catch {
    return [];
  }
}

function writeLocalComposeContacts(userId: string, contacts: ComposeContact[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(composeContactsKey(userId), JSON.stringify(contacts));
  } catch {
    // ignore quota / private mode
  }
}

function mergeContacts(
  existing: ComposeContact[],
  entries: ComposeContactEntry[],
): ComposeContact[] {
  const now = Date.now();
  const byEmail = new Map<string, ComposeContact>();
  for (const contact of existing) {
    byEmail.set(contact.email, contact);
  }
  for (const entry of entries) {
    const email = normalizeEmail(entry.email);
    if (!email) continue;
    const prev = byEmail.get(email);
    byEmail.set(email, {
      email,
      displayName: entry.displayName?.trim() || prev?.displayName,
      lastUsedAt: now,
    });
  }
  return [...byEmail.values()]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
    .slice(0, MAX_CONTACTS);
}

function writeComposeContacts(userId: string, contacts: ComposeContact[]) {
  void writeUiJson(userId, UI_FILES.composeContacts, { contacts })
    .then(() => writeLocalComposeContacts(userId, contacts))
    .catch((err) => {
      console.error("[relaybase] failed to persist compose contacts", err);
    });
}

export function entriesFromRecipientTokens(tokens: string[]): ComposeContactEntry[] {
  const out: ComposeContactEntry[] = [];
  for (const token of tokens) {
    const parsed = parseRecipientToken(token);
    if (!parsed.email) continue;
    out.push({
      email: parsed.email,
      displayName: parsed.displayName,
    });
  }
  return out;
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateComposeContacts(
  userId: string,
): Promise<ComposeContact[]> {
  if (!userId) return [];
  const disk = await readUiJson<ComposeContactsFile>(
    userId,
    UI_FILES.composeContacts,
  );
  if (disk && Array.isArray(disk.contacts)) {
    const contacts = normalizeContacts(disk.contacts);
    writeLocalComposeContacts(userId, contacts);
    return contacts;
  }
  const local = readLocalComposeContacts(userId);
  if (local.length > 0) {
    await writeUiJson(userId, UI_FILES.composeContacts, { contacts: local });
  }
  return local;
}

export function recordComposeContacts(
  userId: string,
  entries: ComposeContactEntry[],
) {
  if (!userId || entries.length === 0) return;
  const existing = readLocalComposeContacts(userId);
  const next = mergeContacts(existing, entries);
  writeComposeContacts(userId, next);
}

export function filterComposeContactSuggestions(
  contacts: ComposeContact[],
  query: string,
  excludeEmails: string[],
): ComposeContact[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const excluded = new Set(excludeEmails.map(normalizeEmail));
  return contacts.filter((contact) => {
    if (excluded.has(contact.email)) return false;
    if (contact.email.startsWith(q)) return true;
    if (contact.displayName?.toLowerCase().includes(q)) return true;
    return false;
  });
}

export function formatComposeContactLabel(contact: ComposeContact): string {
  return contact.displayName
    ? `${contact.displayName} <${contact.email}>`
    : contact.email;
}

export function useComposeContacts() {
  const userId = useProductId();
  const [contacts, setContacts] = React.useState<ComposeContact[]>([]);
  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    if (!userId || hydratedRef.current) return;
    hydratedRef.current = true;
    void hydrateComposeContacts(userId).then(setContacts);
  }, [userId]);

  const recordUsed = React.useCallback(
    (entries: ComposeContactEntry[]) => {
      if (!userId || entries.length === 0) return;
      setContacts((prev) => {
        const next = mergeContacts(prev, entries);
        writeComposeContacts(userId, next);
        return next;
      });
    },
    [userId],
  );

  return { contacts, recordUsed };
}
