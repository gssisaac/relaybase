/**
 * Periodic inbound index integrity check.
 *
 * `_list.json` and the D1 FTS search index are both derived from R2
 * `meta.json`. The ingest path keeps them in sync, but writes are
 * best-effort: a transient D1 failure, a stale overwrite from an offline
 * tool, or a prune race can leave either index drifting from R2. This cron
 * runs the same cheap verify the lazy read path uses, for every configured
 * domain, so drift that no client has touched yet still self-heals within
 * one cron tick (currently every 15 minutes — see `server/wrangler.toml`).
 *
 * R2 stays the source of truth; a rebuild never deletes `meta.json`.
 */
import type { Env } from "../env";
import { createAppDb } from "../../db/app";
import { readMailbox } from "./catalog-store";
import { reconcileInboundIndexIfDrifted } from "./inbound-store";

export async function runInboundIndexCron(env: Env): Promise<void> {
  if (!env.INBOUND) return;

  const mailbox = await readMailbox(createAppDb(env.RELAYBASE_DB));
  for (const domain of mailbox.domains) {
    const normalized = domain.trim().toLowerCase();
    if (!normalized) continue;
    try {
      await reconcileInboundIndexIfDrifted(
        env.INBOUND,
        normalized,
        env.RELAYBASE_INBOX_INDEX,
      );
    } catch (error) {
      console.error(`Inbound index verify failed for ${normalized}`, error);
    }
  }
}
