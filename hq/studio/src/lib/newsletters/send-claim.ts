import type { Newsletter } from "@db/types";
import { findSubscriberGroup } from "@lib/subscriber-groups/group";
import { newToken } from "@lib/shared/ids";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export function resolveTestSendUnsubscribeToken(broadcast: Newsletter, toEmail: string): string {
  if (!broadcast.subscriberGroupId) return newToken();
  const group = findSubscriberGroup(broadcast.subscriberGroupId);
  const normalized = toEmail.trim().toLowerCase();
  const contact = group?.contacts.find((c) => c.email.trim().toLowerCase() === normalized);
  return contact?.unsubscribeToken ?? newToken();
}

/** Atomically move draft → sending so duplicate POST /send cannot double-dispatch. */
export function claimNewsletterForSend(id: string): Newsletter | null {
  let claimed: Newsletter | null = null;
  mutateStudioDocument((draft) => {
    const idx = draft.newsletters.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const row = draft.newsletters[idx]!;
    if (row.status !== "draft") return;
    const now = new Date().toISOString();
    claimed = {
      ...row,
      status: "sending",
      sentAt: now,
      startedAt: now,
      finishedAt: null,
      updatedAt: now,
    };
    draft.newsletters[idx] = claimed;
  });
  return claimed;
}
