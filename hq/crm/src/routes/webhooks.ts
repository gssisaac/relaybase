import { Hono } from "hono";
import { DEV_ACCOUNT_LINK_ID, store } from "../db/store";
import type { AccountSuppressionReason } from "../db/types";
import { newId } from "../lib/ids";

export const crmWebhooks = new Hono();

/**
 * Customer Worker webhook reporting a permanent SMTP bounce or spam complaint
 * (UC-S4, spec §5.3). Flips the specific campaign subscriber to `bounced`
 * (when `campaignId` is known) and always adds the address to the
 * account-wide suppression list — checked unconditionally on every future
 * dispatch regardless of campaign membership.
 */
crmWebhooks.post("/bounce", async (c) => {
  let body: {
    email?: string;
    campaignId?: string;
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
    if (body.campaignId) {
      const idx = draft.subscribers.findIndex(
        (s) => s.campaignId === body.campaignId && s.email === email,
      );
      if (idx >= 0) {
        draft.subscribers[idx] = {
          ...draft.subscribers[idx]!,
          status: "bounced",
          bouncedAt: now,
          bounceReason: body.detail ?? reason,
          updatedAt: now,
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
