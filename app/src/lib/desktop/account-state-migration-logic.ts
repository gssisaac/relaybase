import type { DraftAttachment, DraftEmail } from "@/email/components/mailbox/types";

/**
 * Pure logic extracted from `account-state-migration.ts` so it's testable
 * without mocking the Tauri bridge / `desktopAwareFetch` — see
 * `account-state-migration-logic.test.ts`.
 */

export type MarkerFile = { version: 1; migratedAt: string };

/** Validates a value read back from disk actually looks like our marker (not `null`, not a stale/foreign shape). */
export function isValidMarker(raw: unknown): raw is MarkerFile {
  return (
    raw != null &&
    typeof raw === "object" &&
    (raw as { version?: unknown }).version === 1 &&
    typeof (raw as { migratedAt?: unknown }).migratedAt === "string"
  );
}

/** Extracts the `drafts` array from a `drafts.json` blob, tolerating any malformed/legacy shape. */
export function draftsFromValue(value: unknown): DraftEmail[] {
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { drafts?: unknown }).drafts)
  ) {
    return (value as { drafts: DraftEmail[] }).drafts;
  }
  return [];
}

/**
 * Attachments actually worth uploading during the backfill: only
 * `origin: "local"` ones have bytes on disk. `origin: "source"` attachments
 * are references into an existing inbound/sent message (resolved server-side
 * at send time) and were never written to `draft-attachments/**`.
 */
export function localAttachmentsOf(draft: DraftEmail): DraftAttachment[] {
  return (draft.attachments ?? []).filter((a) => a.origin === "local");
}
