const KEY_PREFIX = "relaybase:mail-accounts:";

export function enabledAccountsKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function readEnabledAccounts(userId: string): string[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = localStorage.getItem(enabledAccountsKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed.filter((value): value is string => typeof value === "string"),
      ),
    ];
  } catch {
    return [];
  }
}

export function writeEnabledAccounts(userId: string, emails: string[]) {
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
