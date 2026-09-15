import { store } from "../../db/store";
import type { AudienceMember } from "../../db/types";
import { isEmailSuppressedForGroup } from "../account/suppression";
import { syncAllBroadcastsForAudienceGroup } from "../broadcasts/audience-sync";
import { newId, newToken } from "../shared/ids";
import { fetchDataSourceContacts } from "./data-source-sync";
import { findAudienceGroup } from "./group";

export async function syncAudienceGroupAsync(
  groupId: string,
  trigger: "manual" | "cron",
): Promise<{ ok: true; totalCount: number; skippedCount: number } | { ok: false; error: string }> {
  const group = findAudienceGroup(groupId);
  if (!group) return { ok: false, error: "not found" };
  if (!group.dataSource?.endpointUrl) {
    return { ok: false, error: "group has no data source" };
  }

  const runId = newId("sync");
  const startedAt = new Date().toISOString();
  store.update((draft) => {
    const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
    if (idx < 0) return;
    draft.audienceGroups[idx]!.syncHistory.unshift({
      id: runId,
      trigger,
      status: "running",
      phase: "fetching",
      startedAt,
    });
  });

  try {
    const { contacts, skipped } = await fetchDataSourceContacts(group.dataSource);
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const g = draft.audienceGroups[idx]!;
      const priorByEmail = new Map(
        g.contacts.map((c) => [c.email.trim().toLowerCase(), c] as const),
      );
      const manual = g.contacts.filter((c) => c.source === "manual");
      const synced: AudienceMember[] = contacts.map((c) => {
        const emailKey = c.email.trim().toLowerCase();
        const prior = priorByEmail.get(emailKey);
        const ledgerBlocked = isEmailSuppressedForGroup(emailKey, groupId, g.accountLinkId);
        let sendStatus = prior?.sendStatus ?? "active";
        if (sendStatus === "active" && ledgerBlocked) sendStatus = "unsubscribed";
        if (prior?.sendStatus === "unsubscribed" || prior?.sendStatus === "bounced") {
          sendStatus = prior.sendStatus;
        }
        return {
          id: prior?.id ?? newId("member"),
          email: c.email,
          name: c.name,
          source: "synced" as const,
          addedAt: prior?.addedAt ?? now,
          sendStatus,
          unsubscribedAt:
            sendStatus === "unsubscribed" ? (prior?.unsubscribedAt ?? now) : null,
          bouncedAt: prior?.bouncedAt ?? null,
          bounceReason: prior?.bounceReason ?? null,
          unsubscribeToken: prior?.unsubscribeToken ?? newToken(),
          consentSource: prior?.consentSource ?? "synced",
          consentedAt: prior?.consentedAt ?? (sendStatus === "active" ? now : null),
        };
      });
      g.contacts = [...manual, ...synced];
      g.lastSyncAt = now;
      g.lastSyncStatus = "success";
      g.lastSyncError = null;
      g.lastSyncCount = synced.length;
      const run = g.syncHistory.find((r) => r.id === runId);
      if (run) {
        run.status = "success";
        run.phase = "done";
        run.finishedAt = now;
        run.totalCount = contacts.length + skipped;
        run.skippedCount = skipped;
        run.successCount = synced.length;
      }
    });
    syncAllBroadcastsForAudienceGroup(groupId);
    return { ok: true, totalCount: contacts.length + skipped, skippedCount: skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync failed";
    const now = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.audienceGroups.findIndex((g) => g.id === groupId);
      if (idx < 0) return;
      const g = draft.audienceGroups[idx]!;
      g.lastSyncAt = now;
      g.lastSyncStatus = "error";
      g.lastSyncError = message;
      const run = g.syncHistory.find((r) => r.id === runId);
      if (run) {
        run.status = "error";
        run.phase = "done";
        run.finishedAt = now;
        run.error = message;
      }
    });
    return { ok: false, error: message };
  }
}
