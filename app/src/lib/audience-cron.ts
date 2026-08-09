import {
  listUserDataKeys,
  readUserEmailDataFromKv,
  syncAudienceGroupInData,
  writeUserEmailDataToKv,
} from "@/lib/dev-email-store";

/** Refresh slightly early rather than slightly late relative to the cron cadence. */
const DUE_GRACE_MS = 60_000;

function isDue(group: {
  lastSyncAt?: string;
  cronIntervalMinutes?: number;
}): boolean {
  if (!group.cronIntervalMinutes || group.cronIntervalMinutes <= 0) return false;
  if (!group.lastSyncAt) return true;
  const elapsedMs = Date.now() - new Date(group.lastSyncAt).getTime();
  return elapsedMs >= group.cronIntervalMinutes * 60_000 - DUE_GRACE_MS;
}

function userIdFromKey(key: string): string {
  return key.slice("userdata:".length);
}

/**
 * Fan-out sync for every user's cron-enabled Audience Groups whose data
 * source is due for a refresh. Runs from the Worker's `scheduled()` handler,
 * outside the OpenNext request context — so the KV binding is passed in
 * explicitly rather than resolved via `getCloudflareContext()`.
 *
 * Mid-run progress is written back to KV so the Progress tab can poll it.
 */
export async function runAudienceGroupCron(
  env: CloudflareEnv,
): Promise<{ usersProcessed: number; groupsSynced: number }> {
  const kv = env.RELAYBASE_APP;
  if (!kv) return { usersProcessed: 0, groupsSynced: 0 };

  const keys = await listUserDataKeys(kv);
  let usersProcessed = 0;
  let groupsSynced = 0;

  for (const key of keys) {
    const userId = userIdFromKey(key);
    if (!userId) continue;

    try {
      const data = await readUserEmailDataFromKv(kv, userId);
      const dueGroups = data.audienceGroups.filter(
        (group) => group.cronEnabled && group.dataSource && isDue(group),
      );
      if (dueGroups.length === 0) continue;

      for (const group of dueGroups) {
        await syncAudienceGroupInData(data, group.id, {
          trigger: "cron",
          onProgress: async (d) => writeUserEmailDataToKv(kv, userId, d),
        });
        groupsSynced++;
      }
      await writeUserEmailDataToKv(kv, userId, data);
      usersProcessed++;
    } catch {
      // Best-effort fan-out — one user's failure shouldn't block the rest.
    }
  }

  return { usersProcessed, groupsSynced };
}
