"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { EmailMailboxAlerts } from "@/relaybase-email/components/EmailMailboxAlerts";
import { EmailMailboxSidebar } from "@/relaybase-email/components/EmailMailboxSidebar";

export type EmailMailboxSection = "compose" | "inbox" | "sent";

type EmailMailboxLayoutProps = {
  section: EmailMailboxSection;
  children: ReactNode;
};

export function EmailMailboxLayout({ section, children }: EmailMailboxLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addresses, accountFilter, setAccountFilter } = useEmailMailbox();

  const accountFromUrl =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;

  useEffect(() => {
    if (
      accountFromUrl &&
      addresses.some((a) => a.email === accountFromUrl)
    ) {
      setAccountFilter(accountFromUrl);
      return;
    }
    if (!accountFromUrl) {
      setAccountFilter("all");
    }
  }, [accountFromUrl, addresses, setAccountFilter]);

  const activeAccount =
    accountFilter !== "all"
      ? accountFilter
      : accountFromUrl && addresses.some((a) => a.email === accountFromUrl)
        ? accountFromUrl
        : null;

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <EmailMailboxSidebar
        section={section}
        pathname={pathname}
        activeAccount={activeAccount}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <EmailMailboxAlerts section={section} />
        {children}
      </div>
    </div>
  );
}
