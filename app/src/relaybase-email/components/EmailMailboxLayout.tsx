"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox, Pencil, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  EmailAccountSelect,
} from "@/relaybase-email/components/EmailAccountSelect";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { EmailMailboxAlerts } from "@/relaybase-email/components/EmailMailboxAlerts";
import { CurrentDomainSelect } from "@/relaybase-email/components/CurrentDomainSelect";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export type EmailMailboxSection = "compose" | "inbox" | "sent";

const SECTIONS: {
  id: EmailMailboxSection;
  label: string;
  icon: LucideIcon;
  hrefKey: "compose" | "inbox" | "sent";
}[] = [
  { id: "compose", label: "Compose", icon: Pencil, hrefKey: "compose" },
  { id: "inbox", label: "Inbox", icon: Inbox, hrefKey: "inbox" },
  { id: "sent", label: "Sent", icon: Send, hrefKey: "sent" },
];

type EmailMailboxLayoutProps = {
  section: EmailMailboxSection;
  children: ReactNode;
};

export function EmailMailboxLayout({ section, children }: EmailMailboxLayoutProps) {
  const pathname = usePathname();
  const { compose, inbox, sent } = useEmailPaths();
  const hrefs = { compose, inbox, sent };
  const {
    addresses,
    accountFilter,
    setAccountFilter,
    inboxCount,
    sentCount,
    refreshing,
    refresh,
  } = useEmailMailbox();

  const counts: Record<EmailMailboxSection, number | undefined> = {
    compose: undefined,
    inbox: inboxCount,
    sent: sentCount,
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/10">
        <div className="space-y-2 border-b border-border p-3">
          <CurrentDomainSelect className="h-9 w-full" />
          <EmailAccountSelect
            addresses={addresses}
            value={accountFilter}
            onChange={setAccountFilter}
            className="h-9 w-full"
          />
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="Mail">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const href = hrefs[item.hrefKey];
            const active =
              section === item.id ||
              pathname === href ||
              pathname.startsWith(`${href}/`);
            const count = counts[item.id];

            return (
              <Link
                key={item.id}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1 text-left">{item.label}</span>
                {count !== undefined && count > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => void refresh(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={refreshing ? "size-4 animate-spin" : "size-4"}
            />
            Refresh
          </Button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <EmailMailboxAlerts section={section} />
        {children}
      </div>
    </div>
  );
}
