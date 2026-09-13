export const DEFAULT_SCRIPT = "relaybase-api";
export const R2_BUCKET = "relaybase-mailbox";

/** Each entry is [binding, dbName]. */
export const D1_DATABASES: Array<[string, string]> = [
  ["RELAYBASE_LOGS", "relaybase-logs"],
  ["RELAYBASE_MAIL", "relaybase-mail"],
  ["RELAYBASE_DB", "relaybase-db"],
];

export const WIPE_PHRASE_DELETE_ME = "DELETE ME";

export function wipeConfirmationAllows(phrase: string | null | undefined, resourceNames: string[]): boolean {
  const p = phrase?.trim();
  if (!p) return false;
  return p === WIPE_PHRASE_DELETE_ME || p === DEFAULT_SCRIPT || resourceNames.includes(p);
}
