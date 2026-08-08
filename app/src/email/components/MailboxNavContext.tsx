"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useEmailPaths } from "@/email/paths";

export type MailboxNav = {
  compose: string;
  inbox: string;
  sent: string;
  trash: string;
};

const MailboxNavContext = createContext<MailboxNav | null>(null);

export function MailboxNavProvider({
  value,
  children,
}: {
  value: MailboxNav;
  children: ReactNode;
}) {
  return (
    <MailboxNavContext.Provider value={value}>
      {children}
    </MailboxNavContext.Provider>
  );
}

export function useMailboxNav(): MailboxNav {
  const override = useContext(MailboxNavContext);
  const { compose, inbox, sent, trash } = useEmailPaths();
  return useMemo(
    () => override ?? { compose, inbox, sent, trash },
    [compose, inbox, override, sent, trash],
  );
}

/** Deep-link into Email mode for a specific account. */
export function accountMailboxNav(email: string): MailboxNav {
  const q = encodeURIComponent(email);
  return {
    compose: `/email/compose?from=${q}`,
    inbox: `/email/inbox?account=${q}`,
    sent: `/email/sent?account=${q}`,
    trash: `/email/trash?account=${q}`,
  };
}
