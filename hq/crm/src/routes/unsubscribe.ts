import { Hono } from "hono";
import { unsubscribeHtmlPage, unsubscribePath } from "../lib/unsubscribe/html-page";
import {
  lookupUnsubscribeContact,
  performBroadcastUnsubscribe,
  resubscribeBroadcastContact,
} from "../lib/unsubscribe/perform";

export const crmUnsubscribe = new Hono();

// GET — confirmation only (no side effects; avoids prefetch auto-unsubscribe)
crmUnsubscribe.get("/:broadcastId/:token", (c) => {
  const { broadcastId, token } = c.req.param();
  const { broadcast, contact } = lookupUnsubscribeContact(broadcastId, token);

  if (!contact) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      unsubscribeHtmlPage({
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
      unsubscribeHtmlPage({
        heading: "Already unsubscribed",
        subtext: `${contact.email} is not on '${broadcast?.name ?? "this list"}'.`,
      }),
    );
  }

  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(
    unsubscribeHtmlPage({
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
  const result = performBroadcastUnsubscribe(broadcastId, token);

  if (!result.ok) {
    return c.json({ error: "invalid token" }, 404);
  }

  const acceptsHtml = c.req.header("Accept")?.includes("text/html");
  if (acceptsHtml) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      unsubscribeHtmlPage({
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
  const { broadcast, contact } = lookupUnsubscribeContact(broadcastId, token);

  if (!contact) {
    c.header("Content-Type", "text/html; charset=utf-8");
    return c.body(
      unsubscribeHtmlPage({
        heading: "Invalid or expired unsubscribe link",
        subtext:
          "If you continue to receive unwanted emails, please contact the sender directly.",
      }),
      404,
    );
  }

  resubscribeBroadcastContact(broadcastId, token);

  c.header("Content-Type", "text/html; charset=utf-8");
  return c.body(
    unsubscribeHtmlPage({
      heading: "You're resubscribed",
      subtext: `${contact.email} will receive emails from '${broadcast?.name ?? "this list"}' again.`,
    }),
  );
});
