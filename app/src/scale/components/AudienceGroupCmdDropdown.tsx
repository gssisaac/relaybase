"use client";

import { useMemo } from "react";

import { CmdDropdown, type CmdDropdownProps } from "@/components/ui/cmd-dropdown";
import type { AudienceGroupSummary } from "@/email/components/mailbox/types";
import {
  audienceGroupCmdGroups,
  filterAudienceGroupsByDomain,
} from "@/scale/lib/audience-group-cmd-groups";

export type AudienceGroupCmdDropdownProps = {
  groups: AudienceGroupSummary[];
  value?: string | null;
  onValueChange?: (
    groupId: string | undefined,
    group?: AudienceGroupSummary,
  ) => void;
  loading?: boolean;
  pinnedGroupIds?: string[];
  /** When set, only groups on this domain are listed. Omit to search all groups. */
  domainFilter?: string | null;
} & Pick<
  CmdDropdownProps,
  | "triggerId"
  | "triggerClassName"
  | "className"
  | "placeholder"
  | "searchPlaceholder"
  | "disabled"
  | "required"
  | "emptyMessage"
  | "contentAlign"
>;

export function AudienceGroupCmdDropdown({
  groups,
  value,
  onValueChange,
  loading = false,
  pinnedGroupIds = [],
  domainFilter,
  placeholder,
  searchPlaceholder = "Search subscriber groups by name or domain…",
  disabled,
  ...cmdProps
}: AudienceGroupCmdDropdownProps) {
  const filtered = useMemo(
    () => filterAudienceGroupsByDomain(groups, domainFilter),
    [groups, domainFilter],
  );

  const pinList = useMemo(
    () => [...pinnedGroupIds, value ?? ""].filter(Boolean),
    [pinnedGroupIds, value],
  );

  const cmdGroups = useMemo(
    () => audienceGroupCmdGroups(filtered, pinList),
    [filtered, pinList],
  );

  const byId = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const hasGroups = cmdGroups.some((g) => g.options.length > 0);
  const resolvedPlaceholder =
    placeholder ??
    (loading
      ? "Loading subscriber groups…"
      : !hasGroups
        ? "No subscriber groups"
        : "Select subscriber group");

  return (
    <CmdDropdown
      {...cmdProps}
      disabled={disabled || loading || !hasGroups}
      value={value?.trim() || null}
      placeholder={resolvedPlaceholder}
      searchPlaceholder={searchPlaceholder}
      groups={cmdGroups}
      onValueChange={(groupId) => {
        if (!groupId) {
          onValueChange?.(undefined);
          return;
        }
        onValueChange?.(groupId, byId.get(groupId));
      }}
    />
  );
}
