"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";

export type MailboxNav = {
  compose: string;
  inbox: string;
  sent: string;
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
  const { compose, inbox, sent } = useEmailPaths();
  return useMemo(
    () => override ?? { compose, inbox, sent },
    [compose, inbox, override, sent],
  );
}

export function accountMailboxNav(email: string): MailboxNav {
  const base = `/accounts/${encodeURIComponent(email)}`;
  return {
    compose: `${base}/compose`,
    inbox: `${base}/inbox`,
    sent: `${base}/sent`,
  };
}
