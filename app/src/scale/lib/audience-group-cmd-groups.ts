import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import type { CmdDropdownOptionGroup } from "@/components/ui/cmd-dropdown";

function pinGroups(
  groups: AudienceGroupSummary[],
  pinnedIds: string[],
): AudienceGroupSummary[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const pinned: AudienceGroupSummary[] = [];
  for (const id of pinnedIds) {
    const trimmed = id.trim();
    if (!trimmed || byId.has(trimmed)) continue;
    pinned.push({
      id: trimmed,
      name: "Subscriber group",
      domain: "",
      contactCount: 0,
      createdAt: "",
    });
  }
  return [...groups, ...pinned];
}

export function audienceGroupCmdGroups(
  groups: AudienceGroupSummary[],
  pinnedIds: string[] = [],
): CmdDropdownOptionGroup[] {
  const candidates = pinGroups(groups, pinnedIds);
  const byDomain = new Map<string, AudienceGroupSummary[]>();
  for (const group of candidates) {
    const domain = group.domain.trim().toLowerCase() || "Other";
    const list = byDomain.get(domain) ?? [];
    list.push(group);
    byDomain.set(domain, list);
  }
  return [...byDomain.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((domain) => ({
      heading: domain,
      options: (byDomain.get(domain) ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((group) => ({
          value: group.id,
          label: `${group.name} · ${group.contactCount.toLocaleString()} contacts`,
          keywords: [group.domain, group.name, group.id].join(" "),
        })),
    }));
}

export function filterAudienceGroupsByDomain(
  groups: AudienceGroupSummary[],
  domain: string | null | undefined,
): AudienceGroupSummary[] {
  const d = domain?.trim().toLowerCase();
  if (!d) return groups;
  return groups.filter((g) => g.domain.toLowerCase() === d);
}
