import { Hono } from "hono";
import { store } from "../db/store";
import { findAudienceContactByUnsubscribeToken } from "../lib/audience-resolver";
import { setAudienceContactSendStatus } from "../lib/audience-send-status";

export const crmUnsubscribe = new Hono();

function page(opts: {
  heading: string;
  subtext: string;
  footer?: string;
  formAction?: string;
}): string {
  const form =
    opts.formAction ?
      `<form method="post" action="${opts.formAction}" style="margin-top:16px;">
  <button type="submit" class="button">Confirm unsubscribe</button>
</form>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${opts.heading}</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; color:#0f172a; }
  main { max-width:420px; margin:24px; padding:40px 32px; background:#fff; border-radius:12px; border:1px solid #e2e8f0; text-align:center; }
  h1 { font-size:18px; margin:0 0 8px; }
  p { font-size:14px; line-height:1.6; color:#475569; margin:0 0 16px; }
  button.button, a.button { display:inline-block; margin-top:8px; padding:8px 16px; border-radius:6px; background:#0f172a; color:#fff; text-decoration:none; font-size:13px; border:0; cursor:pointer; }
  a.link { color:#0f172a; font-size:13px; }
  footer { margin-top:16px; font-size:12px; color:#94a3b8; }
</style>
</head>
<body>
<main>
  <h1>${opts.heading}</h1>
  <p>${opts.subtext}</p>
  ${form}
  ${opts.footer ?? ""}
</main>
</body>
</html>`;
}

function findContactForBroadcast(broadcastId: string, token: string) {
  const data = store.read();
  const broadcast = data.broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast?.audienceGroupId) return { broadcast, contact: undefined };
  const contact = findAudienceContactByUnsubscribeToken(broadcast.audienceGroupId, token);
  return { broadcast, contact };
}

function recordUnsubscribeOnRecipients(broadcastId: string, email: string, now: string) {
  store.update((draft) => {
    let newlyMarked = false;
    for (let i = 0; i < draft.recipients.length; i += 1) {
      const r = draft.recipients[i]!;
      if (r.broadcastId !== broadcastId || r.email !== email || r.unsubscribedAt) continue;
      draft.recipients[i] = { ...r, unsubscribedAt: now };
      newlyMarked = true;
    }
    if (!newlyMarked) return;
    const bIdx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
    if (bIdx >= 0) {
      const stats = draft.broadcasts[bIdx]!.stats;
      draft.broadcasts[bIdx] = {
        ...draft.broadcasts[bIdx]!,
        stats: { ...stats, unsubscribed: stats.unsubscribed + 1 },
      };
    }
  });
}

function performUnsubscribe(broadcastId: string, token: string): { ok: true; email: string; listName: string } | { ok: false } {
  const { broadcast, contact } = findContactForBroadcast(broadcastId, token);
  if (!contact || !broadcast) return { ok: false };

  const now = new Date().toISOString();
  setAudienceContactSendStatus(broadcast.audienceGroupId, contact.id, "unsubscribed", {
    sourceBroadcastId: broadcastId,
  });
  recordUnsubscribeOnRecipients(broadcastId, contact.email, now);

  return {
    ok: true,
    email: contact.email,
    listName: broadcast.name ?? "this list",
  };
}

function unsubscribePath(broadcastId: string, token: string): string {
  return `/crm/unsubscribe/${broadcastId}/${token}`;
}

// GET — confirmation only (no side effects; avoids prefetch auto-unsubscribe)
crmUnsubscribe.get("/:broadcastId/:token", (c) => {
  const { broadcastId, token } = c.req.param();
  const { broadcast, contact } = findContactForBroadcast(broadcastId, token);

  if (!contact) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      page({
        heading: "Invalid or expired unsubscribe link",
        subtext:
          "If you continue to receive unwanted emails, please contact the sender directly.",
      }),
      404,
    );
  }

  if (contact.sendStatus === "unsubscribed") {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      page({
        heading: "Already unsubscribed",
        subtext: `${contact.email} is not on '${broadcast?.name ?? "this list"}'.`,
      }),
    );
  }

  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(
    page({
      heading: "Unsubscribe?",
      subtext: `${contact.email} will stop receiving '${broadcast?.name ?? "this list"}'.`,
      formAction: unsubscribePath(broadcastId, token),
      footer: `<footer><a class="link" href="${unsubscribePath(broadcastId, token)}/resubscribe">Unsubscribed by mistake?</a></footer>`,
    }),
  );
});

// POST — RFC 8058 one-click + form confirm
crmUnsubscribe.post("/:broadcastId/:token", async (c) => {
  const { broadcastId, token } = c.req.param();
  const result = performUnsubscribe(broadcastId, token);

  if (!result.ok) {
    return c.json({ error: "invalid token" }, 404);
  }

  const acceptsHtml = c.req.header("Accept")?.includes("text/html");
  if (acceptsHtml) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      page({
        heading: "You have been unsubscribed",
        subtext: `${result.email} will no longer receive emails from '${result.listName}'.`,
        footer: `<a class="link" href="${unsubscribePath(broadcastId, token)}/resubscribe">Unsubscribed by mistake? Click here to resubscribe.</a>`,
      }),
    );
  }

  return c.body(null, 200);
});

crmUnsubscribe.get("/:broadcastId/:token/resubscribe", (c) => {
  const { broadcastId, token } = c.req.param();
  const { broadcast, contact } = findContactForBroadcast(broadcastId, token);

  if (!contact) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      page({
        heading: "Invalid or expired unsubscribe link",
        subtext:
          "If you continue to receive unwanted emails, please contact the sender directly.",
      }),
      404,
    );
  }

  setAudienceContactSendStatus(broadcast!.audienceGroupId, contact.id, "active");

  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(
    page({
      heading: "You're resubscribed",
      subtext: `${contact.email} will receive emails from '${broadcast?.name ?? "this list"}' again.`,
    }),
  );
});
