"use client";

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ScrollText,
  Settings,
  Smartphone,
} from "lucide-react";
import { useEffect, type ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { AccountDetailTab } from "@/console/lib/paths";
import { AccountLogsView } from "@/console/pages/accounts/AccountLogsView";
import { AccountOtherDeviceView } from "@/console/pages/accounts/AccountOtherDeviceView";
import { AccountOverviewView } from "@/console/pages/accounts/AccountOverviewView";
import { AccountSettingsView } from "@/console/pages/accounts/AccountSettingsView";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { cn } from "@/lib/utils";

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

const NAV: {
  id: AccountDetailTab;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "other-device", label: "Other device", icon: Smartphone },
];

type AccountDetailSheetProps = {
  email: string;
  tab: AccountDetailTab;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTabChange: (tab: AccountDetailTab) => void;
};

function AccountDetailBody({
  email,
  tab,
}: {
  email: string;
  tab: AccountDetailTab;
}): ReactNode {
  if (tab === "logs") return <AccountLogsView email={email} />;
  if (tab === "settings") return <AccountSettingsView email={email} />;
  if (tab === "other-device") return <AccountOtherDeviceView email={email} />;
  return <AccountOverviewView email={email} />;
}

export function AccountDetailSheet({
  email,
  tab,
  open,
  onOpenChange,
  onTabChange,
}: AccountDetailSheetProps) {
  const { setAccountFilter, unreadCountForAccount } = useEmailMailbox();
  const accountsStore = useAccounts();

  const emailKey = email.trim().toLowerCase();
  const domainKey = domainOf(emailKey);
  const address = accountsStore
    .addressesFor(domainKey)
    .find((entry) => entry.email.toLowerCase() === emailKey);
  const title =
    address?.displayName?.trim() || emailKey.split("@")[0] || emailKey;
  const unread = unreadCountForAccount(emailKey);

  useEffect(() => {
    if (!open || !domainKey) return;
    void accountsStore.refresh(domainKey);
  }, [accountsStore, domainKey, open]);

  useEffect(() => {
    if (!open) return;
    setAccountFilter(emailKey);
  }, [emailKey, open, setAccountFilter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-full max-w-[600px] gap-0 overflow-hidden p-0 sm:max-w-[600px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 pr-12">
          <SheetTitle className="truncate">{title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate font-mono text-xs">{emailKey}</span>
            {unread > 0 ? (
              <span
                className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            ) : (
              <span className="shrink-0 text-xs tabular-nums">0 unread</span>
            )}
          </SheetDescription>
        </SheetHeader>

        <nav
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border/60 px-4 py-2"
          aria-label="Account"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.id === tab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <AccountDetailBody email={emailKey} tab={tab} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
