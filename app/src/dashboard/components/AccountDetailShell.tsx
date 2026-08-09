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

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { DomainNavSidebar } from "@/dashboard/components/DomainNavSidebar";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { EmailMailboxAlerts } from "@/email/components/EmailMailboxAlerts";
import { MailboxNavProvider } from "@/email/components/MailboxNavContext";
import { useDashboardPaths } from "@/dashboard/paths";
import {
  emailAccountHref,
  emailComposeHref,
  useEmailPaths,
} from "@/email/paths";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
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
  const { accounts } = useDashboardPaths();
  const { compose, inbox, drafts, sent, trash } = useEmailPaths();
  const { addresses, setAccountFilter } = useEmailMailbox();
  const { noDragClassName, isDesktop } = useDesktopChrome();
  const nav = { compose, inbox, drafts, sent, trash };
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
    if (id === "compose") return emailComposeHref(email);
    if (id === "inbox") return emailAccountHref("inbox", email);
    if (id === "sent") return emailAccountHref("sent", email);
    if (id === "logs") return `${base}/logs`;
    return `${base}/settings`;
  };
  const isFullBleed =
    section === "compose" || section === "inbox" || section === "sent";

  return (
    <MailboxNavProvider value={nav}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DomainNavSidebar
          onDomainSelect={(domain) => {
            const params = new URLSearchParams({ domain });
            router.push(`${accounts}?${params.toString()}`);
          }}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <DesktopTitleBar className="flex-col items-stretch gap-0">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div
                className={cn(noDragClassName)}
                {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-2"
                  nativeButton={false}
                  render={<Link href={accounts} />}
                >
                  <ArrowLeft className="size-4" />
                  Accounts
                </Button>
              </div>
              <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="truncate text-sm font-semibold">{title}</h1>
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              </div>
            </div>
            <nav
              className={cn(
                "flex gap-1 overflow-x-auto px-4 pb-2",
                noDragClassName,
              )}
              aria-label="Account"
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
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
          </DesktopTitleBar>

          <div
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col",
              isFullBleed ? "overflow-hidden" : "overflow-auto",
            )}
          >
            {section === "compose" ||
            section === "inbox" ||
            section === "sent" ? (
              <EmailMailboxAlerts section={section} surface="dashboard" />
            ) : null}
            {children}
          </div>
        </div>
      </div>
    </MailboxNavProvider>
  );
}
