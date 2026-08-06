"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Inbox,
  LayoutDashboard,
  Pencil,
  ScrollText,
  Send,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { DomainNavSidebar } from "@/relaybase-email/components/DomainNavSidebar";
import { useEmailMailbox } from "@/relaybase-email/components/EmailMailboxContext";
import { EmailMailboxAlerts } from "@/relaybase-email/components/EmailMailboxAlerts";
import {
  accountMailboxNav,
  MailboxNavProvider,
} from "@/relaybase-email/components/MailboxNavContext";
import { useEmailPaths } from "@/relaybase-email/components/useEmailPaths";
import { cn } from "@/lib/utils";

export type AccountDetailSection =
  | "overview"
  | "compose"
  | "inbox"
  | "sent"
  | "logs"
  | "settings";

const NAV: {
  id: AccountDetailSection;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "compose", label: "Compose", icon: Pencil },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

type AccountDetailShellProps = {
  email: string;
  section: AccountDetailSection;
  children: ReactNode;
};

export function AccountDetailShell({
  email,
  section,
  children,
}: AccountDetailShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accounts } = useEmailPaths();
  const { addresses, setAccountFilter } = useEmailMailbox();
  const nav = accountMailboxNav(email);
  const base = `/accounts/${encodeURIComponent(email)}`;

  const address = addresses.find(
    (entry) => entry.email.toLowerCase() === email.toLowerCase(),
  );
  const title = address?.displayName?.trim() || email.split("@")[0] || email;

  useEffect(() => {
    setAccountFilter(email);
  }, [email, setAccountFilter]);

  const hrefFor = (id: AccountDetailSection) => {
    if (id === "overview") return base;
    if (id === "compose") {
      return `${nav.compose}?from=${encodeURIComponent(email)}`;
    }
    if (id === "inbox") {
      return `${nav.inbox}?account=${encodeURIComponent(email)}`;
    }
    if (id === "sent") {
      return `${nav.sent}?account=${encodeURIComponent(email)}`;
    }
    if (id === "logs") return `${base}/logs`;
    return `${base}/settings`;
  };

  const isFullBleed =
    section === "compose" || section === "inbox" || section === "sent";

  return (
    <MailboxNavProvider value={nav}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DomainNavSidebar
          onDomainSelect={() => {
            router.push(accounts);
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="shrink-0 border-b border-border">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2"
                render={<Link href={accounts} />}
              >
                <ArrowLeft className="size-4" />
                Accounts
              </Button>
              <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="truncate text-sm font-semibold">{title}</h1>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </div>
            <nav
              className="flex gap-1 overflow-x-auto px-4 pb-2"
              aria-label="Account"
            >
              {NAV.map((item) => {
                const href = hrefFor(item.id);
                const Icon = item.icon;
                const active =
                  item.id === section ||
                  pathname === href ||
                  (item.id !== "overview" && pathname.startsWith(`${href}/`));
                return (
                  <Link
                    key={item.id}
                    href={href}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              isFullBleed ? "overflow-hidden" : "overflow-auto",
            )}
          >
            {section === "compose" ||
            section === "inbox" ||
            section === "sent" ? (
              <EmailMailboxAlerts section={section} />
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </MailboxNavProvider>
  );
}
