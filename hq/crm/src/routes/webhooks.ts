import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AccountSuppressionReason } from "../db/types";
import { newId } from "../lib/ids";

export const crmWebhooks = new Hono();

/**
 * Customer Worker webhook reporting a permanent SMTP bounce or spam complaint
 * (UC-S4, spec §5.3). Marks the audience contact bounced when the broadcast's
 * group is known, and always adds the address to account-wide suppression.
 */
crmWebhooks.post("/bounce", async (c) => {
  let body: {
    email?: string;
    broadcastId?: string;
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
  store.update((draft) => {
    if (body.broadcastId) {
      const broadcast = draft.broadcasts.find((b) => b.id === body.broadcastId);
      if (broadcast?.audienceGroupId) {
        const gIdx = draft.audienceGroups.findIndex((g) => g.id === broadcast.audienceGroupId);
        if (gIdx >= 0) {
          const cIdx = draft.audienceGroups[gIdx]!.contacts.findIndex((c) => c.email === email);
          if (cIdx >= 0) {
            draft.audienceGroups[gIdx]!.contacts[cIdx] = {
              ...draft.audienceGroups[gIdx]!.contacts[cIdx]!,
              sendStatus: "bounced",
              bouncedAt: now,
              bounceReason: body.detail ?? reason,
            };
          }
        }
      }

      for (let i = 0; i < draft.recipients.length; i += 1) {
        const r = draft.recipients[i]!;
        if (r.broadcastId !== body.broadcastId || r.email !== email) continue;
        draft.recipients[i] = {
          ...r,
          status: "bounced",
          bounceReason: body.detail ?? reason,
        };
      }

      const bIdx = draft.broadcasts.findIndex((b) => b.id === body.broadcastId);
      if (bIdx >= 0) {
        const stats = draft.broadcasts[bIdx]!.stats;
        draft.broadcasts[bIdx] = {
          ...draft.broadcasts[bIdx]!,
          stats: { ...stats, bounced: stats.bounced + 1 },
        };
      }
    }

    if (!draft.accountSuppressions.some((s) => s.email === email)) {
      draft.accountSuppressions.push({
        id: newId("suppression"),
        accountLinkId: DEV_ACCOUNT_LINK_ID,
        email,
        reason,
        createdAt: now,
      });
    }
  });

  return c.json({ ok: true });
});

// GET /crm/webhooks/suppressions — account-wide suppression list
crmWebhooks.get("/suppressions", (c) => {
  const rows = store
    .read()
    .accountSuppressions.filter((s) => s.accountLinkId === DEV_ACCOUNT_LINK_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return c.json({ suppressions: rows });
});
