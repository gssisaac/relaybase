/**
 * Broadcast drafts + send progress (Worker KV).
 * Key: srv:catalog:broadcasts
 *
 *   Send history for each message is recorded in srv:sendlog:* via recordSendLog
  and also in D1 RELAYBASE_LOGS via recordOpsLog.
 */

import type { Env } from "../env";
import {
  listContactsForGroups,
  readAudienceCatalog,
  type AudienceCatalog,
} from "./catalog-audience";
import type {
  AudienceGroup,
  AudienceGroupSummary,
  Broadcast,
  BroadcastSendRun,
} from "./catalog-types";
import { createCloudflareClient } from "./cloudflare-config";
import { readMailbox } from "./catalog-store";
import { recordOpsLog } from "./ops-logs";
import { recordSendLog } from "./send-logs";

const BROADCASTS_KV_KEY = "srv:catalog:broadcasts";
const BROADCAST_HISTORY_LIMIT = 20;

function plainTextToEmailHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const withBreaks = escaped.replace(/\n/g, "<br>\n");
  return `<div style="font-family:sans-serif;white-space:pre-wrap">${withBreaks}</div>`;
}

export async function readBroadcasts(kv: KVNamespace): Promise<Broadcast[]> {
  const raw = await kv.get(BROADCASTS_KV_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Broadcast[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function writeBroadcasts(
  kv: KVNamespace,
  broadcasts: Broadcast[],
): Promise<void> {
  await kv.put(BROADCASTS_KV_KEY, JSON.stringify(broadcasts));
}

function normalizeFromAddress(from: string | null | undefined): string | null {
  const trimmed = from?.trim().toLowerCase();
  return trimmed && trimmed.includes("@") ? trimmed : null;
}

function resolveBroadcastGroups(
  catalog: AudienceCatalog,
  groupIds: string[],
): AudienceGroup[] {
  const wanted = new Set(groupIds);
  return catalog.groups.filter((g) => wanted.has(g.id));
}

function summarizeGroup(
  catalog: AudienceCatalog,
  group: AudienceGroup,
): AudienceGroupSummary {
  return {
    ...group,
    contactCount: catalog.contacts.filter((c) => c.groupId === group.id).length,
  };
}

function resolveDefaultFrom(
  mailboxAddresses: Array<{ email: string }>,
  groups: AudienceGroup[],
): string | null {
  for (const group of groups) {
    if (group.defaultFrom) {
      const match = mailboxAddresses.find(
        (a) => a.email.toLowerCase() === group.defaultFrom!.toLowerCase(),
      );
      if (match) return match.email.toLowerCase();
    }
  }
  const domain = groups[0]?.domain;
  if (!domain) return null;
  const onDomain = mailboxAddresses.find((a) =>
    a.email.toLowerCase().endsWith(`@${domain}`),
  );
  return onDomain?.email.toLowerCase() ?? null;
}

export type BroadcastDetail = {
  broadcast: Broadcast;
  groups: AudienceGroupSummary[];
  recipientCount: number;
};

export async function getBroadcastDetail(
  kv: KVNamespace,
  broadcastId: string,
): Promise<BroadcastDetail | null> {
  const [broadcasts, catalog] = await Promise.all([
    readBroadcasts(kv),
    readAudienceCatalog(kv),
  ]);
  const broadcast = broadcasts.find((b) => b.id === broadcastId);
  if (!broadcast) return null;
  const groups = resolveBroadcastGroups(catalog, broadcast.groupIds).map((g) =>
    summarizeGroup(catalog, g),
  );
  const recipientCount = listContactsForGroups(
    catalog,
    broadcast.groupIds,
  ).length;
  return { broadcast, groups, recipientCount };
}

export async function createBroadcastDraft(
  kv: KVNamespace,
  input: {
    id?: string;
    groupIds: string[];
    from?: string;
    subject?: string;
    body?: string;
  },
): Promise<Broadcast> {
  const groupIds = Array.from(new Set(input.groupIds.filter(Boolean)));
  if (groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }

  const [broadcasts, catalog, mailbox] = await Promise.all([
    readBroadcasts(kv),
    readAudienceCatalog(kv),
    readMailbox(kv),
  ]);
  const groups = resolveBroadcastGroups(catalog, groupIds);
  if (groups.length === 0) {
    throw new Error("Audience group(s) not found");
  }

  const from =
    normalizeFromAddress(input.from) ||
    resolveDefaultFrom(mailbox.addresses, groups);
  const domain = from?.split("@")[1]?.toLowerCase() || groups[0]!.domain;
  const subject = input.subject?.trim() || "";
  const body = input.body != null ? input.body : "";
  const recipientCount = listContactsForGroups(catalog, groupIds).length;
  const clientId = input.id?.trim();

  if (clientId) {
    const index = broadcasts.findIndex((b) => b.id === clientId);
    if (index >= 0) {
      const current = broadcasts[index]!;
      if (current.status === "sending" || current.status === "sent") {
        throw new Error("Broadcast was already sent");
      }
      const updated: Broadcast = {
        ...current,
        subject,
        status: "draft",
        domain,
        groupIds,
        body,
        recipientCount,
        ...(from ? { from } : {}),
      };
      if (!from) delete updated.from;
      broadcasts[index] = updated;
      await writeBroadcasts(kv, broadcasts);
      return updated;
    }
  }

  const broadcast: Broadcast = {
    id: clientId || crypto.randomUUID(),
    subject,
    status: "draft",
    createdAt: new Date().toISOString(),
    domain,
    groupIds,
    ...(from ? { from } : {}),
    body,
    recipientCount,
  };
  broadcasts.unshift(broadcast);
  await writeBroadcasts(kv, broadcasts);
  return broadcast;
}

export async function updateBroadcastDraft(
  kv: KVNamespace,
  broadcastId: string,
  patch: {
    groupIds?: string[];
    from?: string | null;
    subject?: string;
    body?: string;
  },
): Promise<Broadcast> {
  const [broadcasts, catalog] = await Promise.all([
    readBroadcasts(kv),
    readAudienceCatalog(kv),
  ]);
  const index = broadcasts.findIndex((b) => b.id === broadcastId);
  if (index < 0) throw new Error("Broadcast not found");
  const current = broadcasts[index]!;
  if (current.status === "sending") {
    throw new Error("Broadcast is sending and cannot be edited");
  }
  if (current.status === "sent") {
    throw new Error("Only draft broadcasts can be edited");
  }
  if (current.status !== "draft" && current.status !== "failed") {
    throw new Error("Only draft broadcasts can be edited");
  }

  let groupIds = current.groupIds;
  if (patch.groupIds !== undefined) {
    groupIds = Array.from(new Set(patch.groupIds.filter(Boolean)));
    if (groupIds.length === 0) {
      throw new Error("Select at least one audience group");
    }
    if (resolveBroadcastGroups(catalog, groupIds).length === 0) {
      throw new Error("Audience group(s) not found");
    }
  }

  const from =
    patch.from === undefined
      ? current.from
      : normalizeFromAddress(patch.from) ?? undefined;
  const subject =
    patch.subject === undefined ? current.subject : patch.subject;
  const body = patch.body === undefined ? current.body : patch.body;
  const domain =
    from?.split("@")[1]?.toLowerCase() ||
    resolveBroadcastGroups(catalog, groupIds)[0]?.domain ||
    current.domain;

  const updated: Broadcast = {
    ...current,
    status: "draft",
    groupIds,
    subject,
    domain,
    body,
    recipientCount: listContactsForGroups(catalog, groupIds).length,
    ...(from ? { from } : {}),
  };
  if (!from) delete updated.from;

  broadcasts[index] = updated;
  await writeBroadcasts(kv, broadcasts);
  return updated;
}

function pushSendHistory(broadcast: Broadcast, run: BroadcastSendRun) {
  const history = broadcast.sendHistory ?? [];
  broadcast.sendHistory = [run, ...history].slice(0, BROADCAST_HISTORY_LIMIT);
}

export async function sendBroadcast(
  env: Env,
  broadcastId: string,
  options: { from?: string } = {},
): Promise<Broadcast> {
  const kv = env.RELAYBASE_APP;
  const [broadcasts, catalog, mailbox] = await Promise.all([
    readBroadcasts(kv),
    readAudienceCatalog(kv),
    readMailbox(kv),
  ]);
  const index = broadcasts.findIndex((b) => b.id === broadcastId);
  if (index < 0) throw new Error("Broadcast not found");
  const current = broadcasts[index]!;
  if (current.status === "sending") {
    throw new Error("Broadcast is already sending");
  }
  if (current.status === "sent") {
    throw new Error("Broadcast was already sent");
  }
  if (current.status !== "draft" && current.status !== "failed") {
    throw new Error("Only draft broadcasts can be sent");
  }
  if (!current.subject?.trim()) {
    throw new Error("Add a subject before broadcasting");
  }
  if (current.groupIds.length === 0) {
    throw new Error("Select at least one audience group");
  }

  const groups = resolveBroadcastGroups(catalog, current.groupIds);
  const from =
    normalizeFromAddress(options.from) ||
    normalizeFromAddress(current.from) ||
    resolveDefaultFrom(mailbox.addresses, groups);
  if (!from) {
    throw new Error("Choose a From address before broadcasting");
  }

  const knownAddress = mailbox.addresses.find(
    (a) => a.email.toLowerCase() === from,
  );
  if (!knownAddress) {
    throw new Error("From address is not a registered sender");
  }

  const domain =
    from.split("@")[1]?.toLowerCase() ||
    current.domain ||
    groups[0]?.domain ||
    "";
  const fromName = knownAddress.displayName?.trim() || undefined;
  const subject = current.subject.trim();
  const text = current.body?.trim() ?? "";
  const html = plainTextToEmailHtml(text);
  const recipients = listContactsForGroups(catalog, current.groupIds);
  const startedAt = new Date().toISOString();
  const run: BroadcastSendRun = {
    id: crypto.randomUUID(),
    status: "running",
    phase: "preparing",
    startedAt,
    totalCount: recipients.length,
    processedCount: 0,
    successCount: 0,
    failedCount: 0,
  };

  current.from = from;
  current.domain = domain;
  current.status = "sending";
  current.recipientCount = recipients.length;
  current.sendProgress = run;
  broadcasts[index] = current;
  await writeBroadcasts(kv, broadcasts);

  try {
    if (recipients.length === 0) {
      throw new Error("No recipients in the selected audience groups");
    }

    run.phase = "sending";
    await writeBroadcasts(kv, broadcasts);

    const cf = await createCloudflareClient(env);
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]!;
      try {
        const result = await cf.sendEmail({
          from,
          fromName,
          to: recipient.email,
          subject,
          text,
          html,
        });
        await recordSendLog(kv, {
          ok: true,
          status: 200,
          domain,
          keyId: null,
          keyPrefix: null,
          keyLabel: "broadcast",
          from,
          to: recipient.email,
          subject,
          messageId: result.messageId,
        });
        await recordOpsLog(env.RELAYBASE_LOGS, {
          kind: "send",
          ok: true,
          status: 200,
          source: "broadcast",
          domain,
          fromAddr: from,
          toAddr: recipient.email,
          subject,
          messageId: result.messageId,
        });
        successCount++;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to send";
        await recordSendLog(kv, {
          ok: false,
          status: 502,
          domain,
          keyId: null,
          keyPrefix: null,
          keyLabel: "broadcast",
          from,
          to: recipient.email,
          subject,
          error: message,
        });
        await recordOpsLog(env.RELAYBASE_LOGS, {
          kind: "send",
          ok: false,
          status: 502,
          source: "broadcast",
          domain,
          fromAddr: from,
          toAddr: recipient.email,
          subject,
          error: message,
        });
        failedCount++;
      }
      run.processedCount = i + 1;
      run.successCount = successCount;
      run.failedCount = failedCount;
      if ((i + 1) % 5 === 0 || i === recipients.length - 1) {
        await writeBroadcasts(kv, broadcasts);
      }
    }

    const finishedAt = new Date().toISOString();
    run.phase = "done";
    run.finishedAt = finishedAt;
    run.estimatedRemainingMs = 0;
    if (successCount === 0) {
      run.status = "error";
      run.error = "All recipients failed";
      current.status = "failed";
    } else {
      run.status = "success";
      current.status = "sent";
      current.sentAt = finishedAt;
      if (failedCount > 0) {
        run.error = `${failedCount} of ${recipients.length} failed`;
      }
    }
    current.sendProgress = run;
    pushSendHistory(current, { ...run });
    broadcasts[index] = current;
    await writeBroadcasts(kv, broadcasts);
    return current;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Broadcast failed";
    const finishedAt = new Date().toISOString();
    run.phase = "done";
    run.status = "error";
    run.finishedAt = finishedAt;
    run.error = message;
    run.estimatedRemainingMs = 0;
    current.status = "failed";
    current.sendProgress = run;
    pushSendHistory(current, { ...run });
    broadcasts[index] = current;
    await writeBroadcasts(kv, broadcasts);
    throw e;
  }
}

export function getBroadcastProgress(broadcast: Broadcast) {
  return {
    broadcastId: broadcast.id,
    status: broadcast.status,
    progress: broadcast.sendProgress ?? null,
    history: broadcast.sendHistory ?? [],
  };
}
