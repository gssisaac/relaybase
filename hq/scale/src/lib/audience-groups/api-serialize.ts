import type { AudienceDataSource, AudienceGroup, AudienceMember } from "../../db/types";

function maskDataSource(ds: AudienceDataSource | null) {
  if (!ds) return undefined;
  return {
    type: ds.type,
    endpointUrl: ds.endpointUrl,
    credential: ds.credential ? "••••••" : undefined,
    credentialHeader: ds.credentialHeader,
  };
}

export function audienceGroupToSummary(group: AudienceGroup) {
  return {
    id: group.id,
    name: group.name,
    domain: group.domain,
    createdAt: group.createdAt,
    contactCount: group.contacts.length,
    defaultFrom: group.defaultFrom ?? undefined,
    dataSource: maskDataSource(group.dataSource),
    cronEnabled: group.cronEnabled,
    cronIntervalMinutes: group.cronIntervalMinutes,
    lastSyncAt: group.lastSyncAt ?? undefined,
    lastSyncStatus: group.lastSyncStatus ?? undefined,
    lastSyncError: group.lastSyncError ?? undefined,
    lastSyncCount: group.lastSyncCount ?? undefined,
    syncHistory: group.syncHistory.slice(0, 20),
  };
}

export function audienceContactToApi(group: AudienceGroup, member: AudienceMember) {
  return {
    id: member.id,
    email: member.email,
    name: member.name ?? undefined,
    domain: group.domain,
    groupId: group.id,
    source: member.source,
    addedAt: member.addedAt,
    sendStatus: member.sendStatus ?? "active",
    unsubscribedAt: member.unsubscribedAt ?? null,
  };
}
