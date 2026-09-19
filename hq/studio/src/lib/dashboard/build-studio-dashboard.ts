import { buildNewsletterInProgressOverview } from "@lib/newsletters/overview";
import { serializeNewsletter } from "@lib/newsletters/serialize";
import { serializeTemplate } from "@lib/messages/serialize-template";
import { serializeLayout } from "@lib/templates/layout-serialize";
import { subscriberGroupToSummary } from "@lib/subscriber-groups/api-serialize";
import { templateCatalogStore } from "@lib/templates/template-catalog-store";
import { catalogTemplateMatchesTarget } from "@lib/templates/catalog-template-meta";
import { buildDashboardSendingAggregate } from "@lib/dashboard/sending-aggregate";
import { DEV_ACCOUNT_LINK_ID } from "@services/studio/constants";
import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

const DASHBOARD_TEMPLATE_LIMIT = 5;

export function buildStudioDashboard() {
  const data = readStudioDocument();
  const accountId = DEV_ACCOUNT_LINK_ID;
  const now = Date.now();
  const dayMs = 86_400_000;
  const in7d = new Date(now + 7 * dayMs).toISOString();

  const broadcasts = data.newsletters.filter((b) => b.accountLinkId === accountId && b.listStatus === "active");
  const groups = data.subscriberGroups.filter((g) => g.accountLinkId === accountId);

  const sendingSerialized = broadcasts
    .filter((b) => b.status === "sending")
    .sort((a, b) => (b.startedAt ?? b.sentAt ?? b.updatedAt).localeCompare(a.startedAt ?? a.sentAt ?? a.updatedAt))
    .map(serializeNewsletter);
  const scheduledSerialized = broadcasts
    .filter((b) => b.status === "scheduled")
    .sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""))
    .map(serializeNewsletter);

  const inProgress = buildNewsletterInProgressOverview({
    sending: sendingSerialized,
    scheduled: scheduledSerialized,
    recipients: data.recipients,
    trackingEvents: data.trackingEvents,
  });

  const sending = buildDashboardSendingAggregate(inProgress.sending);

  const catalogTemplates = templateCatalogStore
    .listAll()
    .map(serializeTemplate)
    .filter((row) => catalogTemplateMatchesTarget(row, "newsletter"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, DASHBOARD_TEMPLATE_LIMIT);

  const layoutIds = new Set(catalogTemplates.map((t) => t.layoutId));
  const layouts = data.layouts
    .filter(
      (row) =>
        layoutIds.has(row.id) &&
        (row.isBuiltin || row.accountLinkId === accountId || row.accountLinkId === null),
    )
    .map(serializeLayout);

  const scheduledRows = broadcasts
    .filter((b) => b.status === "scheduled" || b.status === "sending")
    .map(serializeNewsletter)
    .sort((a, b) => {
      const aAt = a.scheduledAt ?? a.startedAt ?? a.updatedAt;
      const bAt = b.scheduledAt ?? b.startedAt ?? b.updatedAt;
      return aAt.localeCompare(bAt);
    });

  const upcomingIn7d = scheduledRows.filter((row) => {
    const at = row.scheduledAt ?? row.startedAt;
    if (!at) return row.status === "sending";
    return at <= in7d;
  });

  const nextRow = scheduledRows.find((row) => {
    if (row.status === "sending") return true;
    const at = row.scheduledAt;
    return at && new Date(at).getTime() >= now;
  });

  const nextUpcoming = nextRow
    ? {
        id: nextRow.id,
        subject: nextRow.subject,
        scheduledAt: nextRow.scheduledAt ?? nextRow.startedAt ?? nextRow.updatedAt,
        subscriberGroupName: nextRow.subscriberGroupName,
        recipientCount: nextRow.subscriberContactCount ?? nextRow.subscriberActiveCount ?? 0,
        status: nextRow.status as "scheduled" | "sending",
      }
    : null;

  const failedSyncGroups = groups.filter((g) => g.dataSource && g.lastSyncStatus === "error").length;
  const lastSyncAt =
    groups
      .map((g) => g.lastSyncAt)
      .filter((v): v is string => Boolean(v))
      .sort()
      .at(-1) ?? null;

  return {
    generatedAt: new Date(now).toISOString(),
    sending,
    templates: catalogTemplates,
    layouts,
    schedule: {
      nextUpcoming,
      upcomingCount: upcomingIn7d.length,
      upcomingList: scheduledRows.slice(0, 6).map((row) => ({
        id: row.id,
        subject: row.subject,
        scheduledAt: row.scheduledAt ?? row.startedAt ?? row.updatedAt,
        status: row.status as "scheduled" | "sending",
        subscriberGroupName: row.subscriberGroupName,
      })),
    },
    subscribers: {
      groupCount: groups.length,
      recentSyncStatus: {
        lastSyncAt,
        failedGroupsCount: failedSyncGroups,
      },
      groups: groups
        .map(subscriberGroupToSummary)
        .sort((a, b) => b.contactCount - a.contactCount || a.name.localeCompare(b.name))
        .slice(0, 6),
    },
  };
}

export type StudioDashboardPayload = ReturnType<typeof buildStudioDashboard>;
