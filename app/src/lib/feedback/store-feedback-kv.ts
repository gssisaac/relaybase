import { getCloudflareContext } from "@opennextjs/cloudflare";

import {
  feedbackKvKey,
  type FeedbackRecord,
} from "@/lib/feedback/feedback-record";

export async function storeFeedbackInKv(
  record: FeedbackRecord,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const kv = (env as CloudflareEnv).hq_relaybase_feedback;
    if (!kv) {
      return { ok: false, error: "Feedback storage is not configured" };
    }
    const key = feedbackKvKey(record.id, record.createdAt);
    await kv.put(key, JSON.stringify(record));
    return { ok: true, id: record.id };
  } catch {
    return { ok: false, error: "Could not save feedback" };
  }
}
