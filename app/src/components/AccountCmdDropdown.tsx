"use client";

import { useEffect, useMemo } from "react";

import { CmdDropdown, type CmdDropdownProps } from "@/components/ui/cmd-dropdown";
import type { Address } from "@/email/components/mailbox/types";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import {
  accountCmdGroups,
  domainOf,
} from "@/scale/lib/triggers/trigger-account-cmd-groups";

export type AccountCmdDropdownChangeContext = {
  address?: Address;
  domain: string;
};

export type AccountCmdDropdownProps = {
  value?: string | null;
  onValueChange?: (
    email: string | undefined,
    context?: AccountCmdDropdownChangeContext,
  ) => void;
  pinnedEmails?: string[];
  /** When set, only addresses on this domain are listed. */
  domainFilter?: string | null;
  /** Override the address list (e.g. inbound-capable only). */
  addresses?: Address[];
  /** Load addresses from MailAccounts on mount (default true). */
  autoRefresh?: boolean;
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
  | "clearLabel"
>;

export function AccountCmdDropdown({
  value,
  onValueChange,
  pinnedEmails = [],
  domainFilter,
  addresses: addressesOverride,
  autoRefresh = true,
  placeholder,
  searchPlaceholder = "Search by email or domain…",
  disabled,
  ...cmdProps
}: AccountCmdDropdownProps) {
  const { availableAddresses, loading, refreshAddresses } = useMailAccounts();

  useEffect(() => {
    if (autoRefresh && addressesOverride === undefined) {
      void refreshAddresses();
    }
  }, [autoRefresh, addressesOverride, refreshAddresses]);

  const sortedAddresses = useMemo(() => {
    const source = addressesOverride ?? availableAddresses;
    const sorted = sortAddressesByLocalPart(source);
    const filter = domainFilter?.trim().toLowerCase();
    if (!filter) return sorted;
    return sorted.filter((a) => domainOf(a.email, a.domain) === filter);
  }, [addressesOverride, availableAddresses, domainFilter]);

  const pinList = useMemo(
    () => [...pinnedEmails, value ?? ""].filter(Boolean),
    [pinnedEmails, value],
  );

  const groups = useMemo(
    () => accountCmdGroups(sortedAddresses, pinList),
    [sortedAddresses, pinList],
  );

  const allowedEmails = useMemo(
    () => new Set(groups.flatMap((g) => g.options.map((o) => o.value))),
    [groups],
  );

  const normalizedValue = useMemo(() => {
    const v = value?.trim().toLowerCase();
    if (!v) return null;
    return v;
  }, [value]);

  const hasAccounts = groups.length > 0;
  const resolvedPlaceholder =
    placeholder ??
    (loading && addressesOverride === undefined
      ? "Loading accounts…"
      : !hasAccounts
        ? "No accounts in Console"
        : "Select account");

  const dropdownDisabled =
    disabled || (loading && addressesOverride === undefined) || !hasAccounts;

  return (
    <CmdDropdown
      {...cmdProps}
      disabled={dropdownDisabled}
      value={
        normalizedValue && allowedEmails.has(normalizedValue)
          ? normalizedValue
          : normalizedValue
      }
      placeholder={resolvedPlaceholder}
      searchPlaceholder={searchPlaceholder}
      groups={groups}
      onValueChange={(email) => {
        if (!email) {
          onValueChange?.(undefined);
          return;
        }
        const match = sortedAddresses.find(
          (a) => a.email.toLowerCase() === email.toLowerCase(),
        );
        onValueChange?.(email, {
          address: match,
          domain: domainOf(email, match?.domain),
        });
      }}
    />
  );
}
