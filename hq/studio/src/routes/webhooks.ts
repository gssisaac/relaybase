import { Hono } from "hono";
import type { AccountSuppressionReason } from "@db/types";
import { newId } from "@lib/shared/ids";
import { verifyCrmWebhookSecret } from "@lib/webhooks/verify-secret";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export const studioWebhooks = new Hono();

studioWebhooks.post("/bounce", async (c) => {
  if (!verifyCrmWebhookSecret(c)) {
    return c.json({ error: "unauthorized" }, 401);
  }

  let body: {
    email?: string;
    newsletterId?: string;
    reason?: AccountSuppressionReason;
    detail?: string;
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid JSON body" }, 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email?.includes("@")) {
    return c.json({ error: "a valid email is required" }, 400);
  }
  const reason: AccountSuppressionReason = body.reason ?? "hard_bounce";

  const now = new Date().toISOString();
  mutateStudioDocument((draft) => {
    if (body.newsletterId) {
      const broadcast = draft.newsletters.find((b) => b.id === body.newsletterId);
      if (broadcast?.subscriberGroupId) {
        const gIdx = draft.subscriberGroups.findIndex((g) => g.id === broadcast.subscriberGroupId);
        if (gIdx >= 0) {
          const cIdx = draft.subscriberGroups[gIdx]!.contacts.findIndex((c) => c.email === email);
          if (cIdx >= 0) {
            draft.subscriberGroups[gIdx]!.contacts[cIdx] = {
              ...draft.subscriberGroups[gIdx]!.contacts[cIdx]!,
              sendStatus: "bounced",
              bouncedAt: now,
              bounceReason: body.detail ?? reason,
            };
          }
        }
      }

      for (let i = 0; i < draft.recipients.length; i += 1) {
        const r = draft.recipients[i]!;
        if (r.newsletterId !== body.newsletterId || r.email !== email) continue;
        draft.recipients[i] = {
          ...r,
          status: "bounced",
          bounceReason: body.detail ?? reason,
        };
      }

      const bIdx = draft.newsletters.findIndex((b) => b.id === body.newsletterId);
      if (bIdx >= 0) {
        const stats = draft.newsletters[bIdx]!.stats;
        draft.newsletters[bIdx] = {
          ...draft.newsletters[bIdx]!,
          stats: { ...stats, bounced: stats.bounced + 1 },
        };
      }
    }

    const groupId =
      body.newsletterId ?
        draft.newsletters.find((b) => b.id === body.newsletterId)?.subscriberGroupId ?? null
      : null;
    const exists = draft.accountSuppressions.some(
      (s) =>
        s.accountLinkId === DEV_ACCOUNT_LINK_ID &&
        s.email === email &&
        s.subscriberGroupId === null &&
        s.reason === reason,
    );
    if (!exists) {
      draft.accountSuppressions.push({
        id: newId("suppression"),
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        email,
        reason,
        subscriberGroupId: null,
        sourceNewsletterId: body.newsletterId ?? null,
        createdAt: now,
      });
    }
    void groupId;
  });

  return c.json({ ok: true });
});

// GET /studio/webhooks/suppressions — account-wide suppression list
studioWebhooks.get("/suppressions", (c) => {
  const rows = readStudioDocument()
    .accountSuppressions.filter((s) => s.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ suppressions: rows });
});
