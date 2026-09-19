import { getCloudflareContext } from "@opennextjs/cloudflare";

import { feedbackR2ObjectKey } from "@/lib/feedback/feedback-record";

export async function putFeedbackImageInR2(input: {
  feedbackId: string;
  attachmentId: string;
  filename: string;
  contentType: string;
  bytes: ArrayBuffer;
  createdAt: string;
}): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as CloudflareEnv).hq_relaybase_feedback_r2;
    if (!bucket) {
      return { ok: false, error: "Feedback image storage is not configured" };
    }
    const key = feedbackR2ObjectKey(
      input.feedbackId,
      input.attachmentId,
      input.filename,
      input.createdAt,
    );
    await bucket.put(key, input.bytes, {
      httpMetadata: { contentType: input.contentType },
    });
    return { ok: true, key };
  } catch {
    return { ok: false, error: "Could not store feedback image" };
  }
}
