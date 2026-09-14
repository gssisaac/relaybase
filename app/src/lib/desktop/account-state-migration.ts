"use client";

import {
  desktopGetEmailPrefs,
  desktopGetMailJson,
  desktopSaveMailJson,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";
import { desktopAwareFetch } from "@/lib/desktop/api";
import { loadDraftAttachmentBytes } from "@/email/lib/attachments/draft-attachment-store";
import { saveDraftAttachmentBytes as uploadDraftAttachmentBytes } from "@/mail-platform/account-state";
import { UI_FILES } from "@/email/lib/disk/user-ui-disk";
import { saveRemoteBroadcastDrafts } from "@/lib/dashboard/broadcast-drafts-disk";
import {
  draftsFromValue,
  isValidMarker,
  localAttachmentsOf,
  type MarkerFile,
} from "@/lib/desktop/account-state-migration-logic";
import type { DraftEmail } from "@/email/components/mailbox/types";

/**
 * One-time desktop → Worker backfill for existing installs.
 *
 * Historical `~/.relaybase/{scopeId}/*` state predates D1 `account_state`
 * (see `docs/architecture/account-state-d1.md`) — new writes already mirror
 * to the Worker going forward (via `user-ui-disk.ts`, `email-prefs.ts`, etc.),
 * but a user's *existing* sidebar/drafts/etc. only reaches the Worker once
 * this has run once. Idempotent (marker file) and safe to retry — every
 * underlying write is an upsert.
 *
 * Call `runAccountStateBackfillOnce()` once mail is confirmed connected
 * (a real Worker session, not just credentials loaded) — see
 * `MailAccountsStore.runPrimaryBootstrap()`, which is the first place a
 * successful authenticated fetch is expected to succeed. Calling this too
 * early (before an access token exists) just fails harmlessly and retries
 * next time this function is invoked — nothing here is one-shot-fragile
 * except the marker write itself, which only happens on full success.
 */

const OPERATOR_ID = "desktop";
const MARKER_RELATIVE_PATH = "account-state-migrated-v1.json";

let inFlight: Promise<void> | null = null;

async function readJsonAtDesktopPath(relativePath: string): Promise<unknown | null> {
  try {
    return await desktopGetMailJson(relativePath);
  } catch {
    return null;
  }
}

async function readMarker(): Promise<MarkerFile | null> {
  const raw = await readJsonAtDesktopPath(MARKER_RELATIVE_PATH);
  return isValidMarker(raw) ? raw : null;
}

async function writeMarker(): Promise<void> {
  const marker: MarkerFile = { version: 1, migratedAt: new Date().toISOString() };
  await desktopSaveMailJson(MARKER_RELATIVE_PATH, marker);
}

type BulkImportItem = { namespace: string; key: string; value: unknown };

async function collectAccountStateItems(): Promise<{
  items: BulkImportItem[];
  drafts: DraftEmail[];
}> {
  const items: BulkImportItem[] = [];

  for (const file of Object.values(UI_FILES)) {
    const value = await readJsonAtDesktopPath(`${OPERATOR_ID}/ui/${file}`);
    if (value != null) items.push({ namespace: "ui", key: file, value });
  }

  try {
    const prefs = await desktopGetEmailPrefs();
    if (prefs != null) {
      items.push({ namespace: "prefs", key: "email.json", value: prefs });
    }
  } catch {
    // best-effort — email prefs are not critical enough to abort the backfill
  }

  const draftsValue = await readJsonAtDesktopPath(`${OPERATOR_ID}/drafts.json`);
  const drafts = draftsFromValue(draftsValue);
  if (draftsValue != null) {
    items.push({ namespace: "mail", key: "drafts.json", value: draftsValue });
  }

  return { items, drafts };
}

async function bulkImport(items: BulkImportItem[]): Promise<void> {
  if (items.length === 0) return;
  const res = await desktopAwareFetch("/api/email/account-state/bulk-import", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    throw new Error(`account-state bulk-import failed (${res.status})`);
  }
}

/** Uploads bytes for every locally-sourced (`origin: "local"`) draft attachment. */
async function uploadDraftAttachments(drafts: DraftEmail[]): Promise<void> {
  for (const draft of drafts) {
    for (const attachment of localAttachmentsOf(draft)) {
      const bytes = await loadDraftAttachmentBytes(
        OPERATOR_ID,
        draft.id,
        attachment.id,
      );
      if (!bytes) continue;
      await uploadDraftAttachmentBytes(draft.id, attachment.id, bytes, {
        filename: attachment.filename,
        contentType: attachment.contentType,
      });
    }
  }
}

/**
 * Broadcast drafts-in-progress live under the dashboard's own `productId`
 * (usually `"desktop"` for the owner console, same as everything else here).
 * Best-effort and independent of the rest — a miss here does not abort the
 * primary backfill.
 */
async function uploadBroadcastDrafts(): Promise<void> {
  const value = await readJsonAtDesktopPath(`${OPERATOR_ID}/broadcast-drafts.json`);
  if (value == null) return;
  await saveRemoteBroadcastDrafts(value);
}

async function runBackfill(): Promise<void> {
  if (!isDesktopRuntime()) return;
  if (await readMarker()) return;

  const { items, drafts } = await collectAccountStateItems();
  await bulkImport(items);
  await uploadDraftAttachments(drafts);

  try {
    await uploadBroadcastDrafts();
  } catch (err) {
    // Broadcast drafts are owner/console-only and non-critical — log and
    // continue so the (more important) mail/UI state backfill still counts
    // as done.
    console.error(
      "[relaybase] account-state migration: broadcast-drafts upload failed",
      err,
    );
  }

  await writeMarker();
}

/**
 * Fire-and-forget entry point. Never throws — failures are logged and simply
 * retried the next time this is called (no marker written on failure).
 */
export function runAccountStateBackfillOnce(): void {
  if (!isDesktopRuntime()) return;
  if (inFlight) return;
  inFlight = runBackfill()
    .catch((err) => {
      console.error("[relaybase] account-state migration failed, will retry later", err);
    })
    .finally(() => {
      inFlight = null;
    });
}
