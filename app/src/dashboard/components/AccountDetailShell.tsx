"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  LayoutDashboard,
  ScrollText,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";

import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Button } from "@/components/ui/button";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { accountDetailHref, useDashboardPaths } from "@/dashboard/paths";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

export type AccountDetailSection = "overview" | "logs" | "settings";

const NAV: {
  id: AccountDetailSection;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
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
  const { accounts } = useDashboardPaths();
  const { addresses, setAccountFilter, unreadCountForAccount } =
    useEmailMailbox();
  const { noDragClassName, isDesktop } = useDesktopChrome();

  const address = addresses.find(
    (entry) => entry.email.toLowerCase() === email.toLowerCase(),
  );
  const title = address?.displayName?.trim() || email.split("@")[0] || email;
  const unread = unreadCountForAccount(email);

  useEffect(() => {
    setAccountFilter(email);
  }, [email, setAccountFilter]);

  const hrefFor = (id: AccountDetailSection) => accountDetailHref(email, id);

  return (
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
            {unread > 0 ? (
              <span
                className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : (
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                0 unread
              </span>
            )}
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
            const active = item.id === section;
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        {children}
      </div>
    </div>
  );
}
