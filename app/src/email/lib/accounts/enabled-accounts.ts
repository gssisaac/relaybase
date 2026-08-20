import { readUiJson, UI_FILES, writeUiJson } from "@/email/lib/disk/user-ui-disk";

const KEY_PREFIX = "relaybase:mail-accounts:";

export function enabledAccountsKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

function normalizeEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw.filter(
        (value): value is string => typeof value === "string" && value.length > 0,
      ),
    ),
  ];
}

export function readEnabledAccounts(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(enabledAccountsKey(userId));
    if (!raw) return [];
    return normalizeEmails(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

function writeLocalEnabledAccounts(userId: string, emails: string[]) {
  if (typeof window === "undefined" || !userId) return;
  try {
    localStorage.setItem(
      enabledAccountsKey(userId),
      JSON.stringify([...new Set(emails)]),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function writeEnabledAccounts(userId: string, emails: string[]) {
  const next = [...new Set(emails)];
  void writeUiJson(userId, UI_FILES.enabledAccounts, { emails: next })
    .then(() => writeLocalEnabledAccounts(userId, next))
    .catch((err) => {
      console.error("[relaybase] failed to persist enabled accounts", err);
    });
}

/** Load from ~/.relaybase (desktop), migrate legacy localStorage once. */
export async function hydrateEnabledAccounts(userId: string): Promise<string[]> {
  if (!userId) return [];
  const disk = await readUiJson<{ emails?: unknown }>(
    userId,
    UI_FILES.enabledAccounts,
  );
  if (disk && Array.isArray(disk.emails)) {
    const emails = normalizeEmails(disk.emails);
    writeLocalEnabledAccounts(userId, emails);
    return emails;
  }
  const local = readEnabledAccounts(userId);
  if (local.length > 0) {
    await writeUiJson(userId, UI_FILES.enabledAccounts, { emails: local });
  }
  return local;
}

export function localPart(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export function sortAddressesByLocalPart<T extends { email: string }>(
  addresses: T[],
): T[] {
  return [...addresses].sort((a, b) => {
    const la = localPart(a.email).toLowerCase();
    const lb = localPart(b.email).toLowerCase();
    if (la !== lb) return la.localeCompare(lb);
    return a.email.toLowerCase().localeCompare(b.email.toLowerCase());
  });
}
