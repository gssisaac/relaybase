import { store } from "../../db/store";
import type { AudienceMember, Campaign } from "../../db/types";
import { sendMail } from "../mail/sender";
import { resolveWorkerSendCredentials } from "../mail/credentials";
import { buildListUnsubscribeUrl, renderCampaignForRecipient } from "../render/render";
import { SCALE_PUBLIC_BASE_URL } from "../shared/scale-url";
import { newId } from "../shared/ids";
import { DISPATCH_BATCH_SIZE } from "./dispatch-progress";
import { requireMessage } from "../messages/resolve";
import { getCampaignLayoutHtml, getCampaignLayoutSchema } from "./serialize";
import { rollupCampaignStatsFromRecipients } from "./stats";

/** Small lists send inline; larger audiences queue and drain via scheduler batches. */
const INLINE_RECIPIENT_MAX = 50;

export { DISPATCH_BATCH_SIZE };

/** Prevents scheduler + HTTP send from processing the same broadcast concurrently. */
const dispatchInFlight = new Set<string>();

function enqueueCampaignRecipients(
  broadcast: Campaign,
  members: AudienceMember[],
  now: string,
): void {
  store.update((draft) => {
    const existing = new Set(
      draft.recipients
        .filter((r) => r.campaignId === broadcast.id)
        .map((r) => r.audienceMemberId),
    );
    for (const m of members) {
      if (existing.has(m.id)) continue;
      draft.recipients.push({
        id: newId("recipient"),
        campaignId: broadcast.id,
        audienceMemberId: m.id,
        email: m.email,
        name: m.name ?? null,
        status: "queued",
        errorMessage: null,
        bounceReason: null,
        sentAt: null,
        deliveredAt: null,
        openedAt: null,
        clickedAt: null,
        unsubscribedAt: null,
        openCount: 0,
        clickCount: 0,
        createdAt: now,
      });
      existing.add(m.id);
    }
  });
}

function rollupStatsForBroadcast(campaignId: string) {
  const data = store.read();
  return rollupCampaignStatsFromRecipients(
    data.recipients.filter((r) => r.campaignId === campaignId),
    data.trackingEvents.filter((e) => e.campaignId === campaignId),
  );
}

function finalizeCampaignDispatchIfIdle(campaignId: string): boolean {
  const data = store.read();
  const idx = data.campaigns.findIndex((b) => b.id === campaignId);
  if (idx < 0) return true;
  const broadcast = data.campaigns[idx]!;
  if (broadcast.status !== "sending") return true;

  const pending = data.recipients.filter(
    (r) =>
      r.campaignId === campaignId &&
      (r.status === "queued" || r.status === "sending"),
  );
  if (pending.length > 0) return false;

  const now = new Date().toISOString();
  const stats = rollupStatsForBroadcast(campaignId);
  store.update((draft) => {
    const rowIdx = draft.campaigns.findIndex((b) => b.id === campaignId);
    if (rowIdx < 0) return;
    draft.campaigns[rowIdx] = {
      ...draft.campaigns[rowIdx]!,
      status: "sent",
      sentAt: draft.campaigns[rowIdx]!.sentAt ?? now,
      startedAt: draft.campaigns[rowIdx]!.startedAt ?? draft.campaigns[rowIdx]!.sentAt ?? now,
      finishedAt: now,
      stats,
      updatedAt: now,
    };
  });
  return true;
}

/** Process up to `limit` queued recipients for a broadcast in `sending` status. */
export async function processCampaignDispatchBatch(
  campaignId: string,
  limit: number,
): Promise<{ sent: number; failed: number; skipped: number; completed: boolean }> {
  const broadcast = store.read().campaigns.find((b) => b.id === campaignId);
  if (!broadcast || broadcast.status !== "sending") {
    return { sent: 0, failed: 0, skipped: 0, completed: true };
  }
  if (dispatchInFlight.has(campaignId)) {
    return { sent: 0, failed: 0, skipped: 0, completed: false };
  }
  dispatchInFlight.add(campaignId);

  try {
    return await runBroadcastDispatchBatch(campaignId, limit);
  } finally {
    dispatchInFlight.delete(campaignId);
  }
}

async function runBroadcastDispatchBatch(
  campaignId: string,
  limit: number,
): Promise<{ sent: number; failed: number; skipped: number; completed: boolean }> {
  const broadcast = store.read().campaigns.find((b) => b.id === campaignId);
  if (!broadcast || broadcast.status !== "sending") {
    return { sent: 0, failed: 0, skipped: 0, completed: true };
  }

  const message = requireMessage(store.read(), broadcast.templateId);
  const layoutId = message.layoutId ?? "tpl-minimal";
  const templateHtml = getCampaignLayoutHtml(layoutId) ?? "<div>{{content}}</div>";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const queued = store
    .read()
    .recipients.filter((r) => r.campaignId === campaignId && r.status === "queued")
    .slice(0, limit);

  const fromEmail = broadcast.fromEmail?.trim() ?? "";
  if (!fromEmail) {
    const now = new Date().toISOString();
    for (const recipient of queued) {
      failed += 1;
      store.update((draft) => {
        const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
        if (idx < 0) return;
        draft.recipients[idx] = {
          ...draft.recipients[idx]!,
          status: "failed",
          errorMessage: "Missing sender email — set From on Settings before sending.",
          sentAt: now,
        };
      });
    }
    return { sent: 0, failed, skipped: 0, completed: finalizeCampaignDispatchIfIdle(campaignId) };
  }

  const auth = resolveWorkerSendCredentials();
  if (!auth.ok) {
    const now = new Date().toISOString();
    for (const recipient of queued) {
      failed += 1;
      store.update((draft) => {
        const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
        if (idx < 0) return;
        draft.recipients[idx] = {
          ...draft.recipients[idx]!,
          status: "failed",
          errorMessage: auth.error,
          sentAt: now,
        };
      });
    }
    return { sent: 0, failed, skipped: 0, completed: finalizeCampaignDispatchIfIdle(campaignId) };
  }

  for (const recipient of queued) {
    const live = store.read().recipients.find((r) => r.id === recipient.id);
    if (
      live &&
      (live.status === "delivered" ||
        live.status === "failed" ||
        live.status === "skipped" ||
        (live.status === "sending" && live.sentAt))
    ) {
      skipped += 1;
      continue;
    }

    const member = store
      .read()
      .audienceGroups.flatMap((g) => g.contacts)
      .find((m) => m.id === recipient.audienceMemberId);
    if (!member || member.sendStatus !== "active") {
      skipped += 1;
      store.update((draft) => {
        const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
        if (idx >= 0) draft.recipients[idx] = { ...draft.recipients[idx]!, status: "skipped" };
      });
      continue;
    }

    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
      if (idx >= 0) draft.recipients[idx] = { ...draft.recipients[idx]!, status: "sending" };
    });

    const html = renderCampaignForRecipient({
      broadcastId: broadcast.id,
      recipientId: recipient.id,
      bodyMarkdown: message.bodyMarkdown,
      templateId: layoutId,
      templateHtml,
      templateVariablesSchema: getCampaignLayoutSchema(layoutId),
      templateVariables: message.templateVariables ?? {},
      recipient: { email: recipient.email, name: recipient.name },
      unsubscribeToken: member.unsubscribeToken,
      scaleBaseUrl: SCALE_PUBLIC_BASE_URL,
    });
    const listUnsubscribeUrl = buildListUnsubscribeUrl(
      SCALE_PUBLIC_BASE_URL,
      broadcast.id,
      member.unsubscribeToken,
    );
    const result = await sendMail({
      to: recipient.email,
      from: fromEmail,
      fromName: broadcast.fromName,
      replyTo: broadcast.replyTo,
      subject: message.subject,
      html,
      listUnsubscribeUrl,
    });
    const sentAt = new Date().toISOString();
    store.update((draft) => {
      const idx = draft.recipients.findIndex((r) => r.id === recipient.id);
      if (idx < 0) return;
      draft.recipients[idx] = {
        ...draft.recipients[idx]!,
        status: result.ok ? "delivered" : "failed",
        sentAt: result.ok ? sentAt : draft.recipients[idx]!.sentAt,
        deliveredAt: result.ok ? sentAt : null,
        errorMessage: result.ok ? null : result.error,
      };
    });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  store.update((draft) => {
    const idx = draft.campaigns.findIndex((b) => b.id === campaignId);
    if (idx < 0) return;
    draft.campaigns[idx] = {
      ...draft.campaigns[idx]!,
      stats: rollupStatsForBroadcast(campaignId),
      updatedAt: new Date().toISOString(),
    };
  });

  const completed = finalizeCampaignDispatchIfIdle(campaignId);
  return { sent, failed, skipped, completed };
}

export async function dispatchCampaignToAudience(
  broadcast: Campaign,
  members: AudienceMember[],
): Promise<{ sent: number; failed: number; skipped: number; async?: boolean; queued?: number }> {
  const now = new Date().toISOString();
  enqueueCampaignRecipients(broadcast, members, now);

  const asyncDispatch = members.length > INLINE_RECIPIENT_MAX;
  if (asyncDispatch) {
    await processCampaignDispatchBatch(broadcast.id, DISPATCH_BATCH_SIZE);
    return { sent: 0, failed: 0, skipped: 0, async: true, queued: members.length };
  }

  const result = await processCampaignDispatchBatch(broadcast.id, members.length + 1000);
  return { sent: result.sent, failed: result.failed, skipped: result.skipped, async: false };
}
