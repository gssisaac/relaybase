"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import { EmailPageSuspenseFallback } from "@/email/components/mailbox/EmailPageSuspenseFallback";
import { OwnerNoMailAccountsView } from "@/email/components/mailbox/OwnerNoMailAccountsView";
import { EmailMailboxAlerts } from "./EmailMailboxAlerts";

export type EmailMailboxSection =
  | "compose"
  | "inbox"
  | "drafts"
  | "sent"
  | "trash"
  | "settings";

type EmailMailboxLayoutProps = {
  section: EmailMailboxSection;
  children: ReactNode;
};

export function EmailMailboxLayout({
  section,
  children,
}: EmailMailboxLayoutProps) {
  const searchParams = useSearchParams();
  const { enabledAddresses, isTeamMode, phase: accountsPhase } =
    useMailAccounts();
  const { setAccountFilter } = useEmailMailbox();

  const accountFromUrl =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;

  useEffect(() => {
    if (
      accountFromUrl &&
      enabledAddresses.some(
        (a) => a.email.toLowerCase() === accountFromUrl.toLowerCase(),
      )
    ) {
      setAccountFilter(accountFromUrl);
      return;
    }
    setAccountFilter("all");
  }, [accountFromUrl, enabledAddresses, setAccountFilter]);

  // Owner with no mailbox accounts: dedicated empty page, not Inbox/Sent chrome.
  // Settings stays reachable. Team users keep the normal empty folder.
  const ownerMailbox = !isTeamMode && section !== "settings";
  const showOwnerNoAccounts =
    ownerMailbox && accountsPhase === "done" && enabledAddresses.length === 0;
  const waitForOwnerAccounts = ownerMailbox && accountsPhase !== "done";

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {showOwnerNoAccounts ? (
          <OwnerNoMailAccountsView />
        ) : waitForOwnerAccounts ? (
          <EmailPageSuspenseFallback />
        ) : (
          <>
            <EmailMailboxAlerts section={section} />
            {children}
          </>
        )}
      </div>
    </div>
  );
}
