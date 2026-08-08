"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { EmailMailboxAlerts } from "@/email/components/EmailMailboxAlerts";
import { useMailAccounts } from "@/email/components/MailAccountsContext";

export type EmailMailboxSection = "compose" | "inbox" | "sent" | "trash";

type EmailMailboxLayoutProps = {
  section: EmailMailboxSection;
  children: ReactNode;
};

export function EmailMailboxLayout({
  section,
  children,
}: EmailMailboxLayoutProps) {
  const searchParams = useSearchParams();
  const { enabledAddresses } = useMailAccounts();
  const { setAccountFilter } = useEmailMailbox();

  const accountFromUrl =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;

  useEffect(() => {
    if (
      accountFromUrl &&
      enabledAddresses.some((a) => a.email === accountFromUrl)
    ) {
      setAccountFilter(accountFromUrl);
      return;
    }
    if (!accountFromUrl) {
      setAccountFilter("all");
    }
  }, [accountFromUrl, enabledAddresses, setAccountFilter]);

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <EmailMailboxAlerts section={section} />
        {children}
      </div>
    </div>
  );
}
