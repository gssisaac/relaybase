import { store } from "../../db/store";
import type { AudienceMember, Broadcast } from "../../db/types";
import { sendMail } from "../mail/sender";
import { resolveWorkerSendCredentials } from "../mail/credentials";
import { buildListUnsubscribeUrl, renderBroadcastForRecipient } from "../render/render";
import { CRM_PUBLIC_BASE_URL } from "../shared/crm-url";
import { newId } from "../shared/ids";
import { DISPATCH_BATCH_SIZE } from "./dispatch-progress";
import { getBroadcastTemplateHtml, getBroadcastTemplateSchema } from "./serialize";
import { rollupBroadcastStatsFromRecipients } from "./stats";

/** Small lists send inline; larger audiences queue and drain via scheduler batches. */
const INLINE_RECIPIENT_MAX = 50;

export { DISPATCH_BATCH_SIZE };

function enqueueBroadcastRecipients(
  broadcast: Broadcast,
  members: AudienceMember[],
  now: string,
): void {
  store.update((draft) => {
    const existing = new Set(
      draft.recipients
        .filter((r) => r.broadcastId === broadcast.id)
        .map((r) => r.audienceMemberId),
    );
    for (const m of members) {
      if (existing.has(m.id)) continue;
      draft.recipients.push({
        id: newId("recipient"),
        broadcastId: broadcast.id,
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

function rollupStatsForBroadcast(broadcastId: string) {
  const data = store.read();
  return rollupBroadcastStatsFromRecipients(
    data.recipients.filter((r) => r.broadcastId === broadcastId),
    data.trackingEvents.filter((e) => e.broadcastId === broadcastId),
  );
}

function finalizeBroadcastDispatchIfIdle(broadcastId: string): boolean {
  const data = store.read();
  const idx = data.broadcasts.findIndex((b) => b.id === broadcastId);
  if (idx < 0) return true;
  const broadcast = data.broadcasts[idx]!;
  if (broadcast.status !== "sending") return true;

  const pending = data.recipients.filter(
    (r) =>
      r.broadcastId === broadcastId &&
      (r.status === "queued" || r.status === "sending"),
  );
  if (pending.length > 0) return false;

  const now = new Date().toISOString();
  const stats = rollupStatsForBroadcast(broadcastId);
  store.update((draft) => {
    const rowIdx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
    if (rowIdx < 0) return;
    draft.broadcasts[rowIdx] = {
      ...draft.broadcasts[rowIdx]!,
      status: "sent",
      sentAt: draft.broadcasts[rowIdx]!.sentAt ?? now,
      startedAt: draft.broadcasts[rowIdx]!.startedAt ?? draft.broadcasts[rowIdx]!.sentAt ?? now,
      finishedAt: now,
      stats,
      updatedAt: now,
    };
  });
  return true;
}

/** Process up to `limit` queued recipients for a broadcast in `sending` status. */
export async function processBroadcastDispatchBatch(
  broadcastId: string,
  limit: number,
): Promise<{ sent: number; failed: number; skipped: number; completed: boolean }> {
  const broadcast = store.read().broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast || broadcast.status !== "sending") {
    return { sent: 0, failed: 0, skipped: 0, completed: true };
  }

  const templateHtml =
    getBroadcastTemplateHtml(broadcast.templateId ?? broadcast.defaultTemplateId) ??
    "<div>{{content}}</div>";

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const queued = store
    .read()
    .recipients.filter((r) => r.broadcastId === broadcastId && r.status === "queued")
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
    return { sent: 0, failed, skipped: 0, completed: finalizeBroadcastDispatchIfIdle(broadcastId) };
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
    return { sent: 0, failed, skipped: 0, completed: finalizeBroadcastDispatchIfIdle(broadcastId) };
  }

  for (const recipient of queued) {
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

    const templateId = broadcast.templateId ?? broadcast.defaultTemplateId;
    const html = renderBroadcastForRecipient({
      broadcastId: broadcast.id,
      recipientId: recipient.id,
      bodyMarkdown: broadcast.bodyMarkdown,
      templateId,
      templateHtml,
      templateVariablesSchema: getBroadcastTemplateSchema(templateId),
      templateVariables: broadcast.templateVariables ?? {},
      recipient: { email: recipient.email, name: recipient.name },
      unsubscribeToken: member.unsubscribeToken,
      crmBaseUrl: CRM_PUBLIC_BASE_URL,
    });
    const listUnsubscribeUrl = buildListUnsubscribeUrl(
      CRM_PUBLIC_BASE_URL,
      broadcast.id,
      member.unsubscribeToken,
    );
    const result = await sendMail({
      to: recipient.email,
      from: fromEmail,
      fromName: broadcast.fromName,
      replyTo: broadcast.replyTo,
      subject: broadcast.subject,
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
    const idx = draft.broadcasts.findIndex((b) => b.id === broadcastId);
    if (idx < 0) return;
    draft.broadcasts[idx] = {
      ...draft.broadcasts[idx]!,
      stats: rollupStatsForBroadcast(broadcastId),
      updatedAt: new Date().toISOString(),
    };
  });

  const completed = finalizeBroadcastDispatchIfIdle(broadcastId);
  return { sent, failed, skipped, completed };
}

export async function dispatchBroadcastToAudience(
  broadcast: Broadcast,
  members: AudienceMember[],
): Promise<{ sent: number; failed: number; skipped: number; async?: boolean; queued?: number }> {
  const now = new Date().toISOString();
  enqueueBroadcastRecipients(broadcast, members, now);

  const asyncDispatch = members.length > INLINE_RECIPIENT_MAX;
  if (asyncDispatch) {
    await processBroadcastDispatchBatch(broadcast.id, DISPATCH_BATCH_SIZE);
    return { sent: 0, failed: 0, skipped: 0, async: true, queued: members.length };
  }

  const result = await processBroadcastDispatchBatch(broadcast.id, members.length + 1000);
  return { sent: result.sent, failed: result.failed, skipped: result.skipped, async: false };
}
