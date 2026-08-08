"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  Inbox,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";
import { AddEmailAccountDialog } from "@/email/components/AddEmailAccountDialog";
import { useMailAccounts } from "@/email/components/MailAccountsContext";
import {
  emailFolderHref,
  type EmailFolder,
} from "@/email/paths";
import { useDashboardPaths } from "@/dashboard/paths";
import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  modeFromPathname,
  readLastPath,
  writeLastPath,
  writeSidebarMode,
  type SidebarMode,
} from "@/email/sidebar-mode";

function isActive(href: string, pathname: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function FolderTree({
  label,
  icon: Icon,
  folder,
  pathname,
  accountParam,
  accounts,
  getColor,
  defaultOpen,
}: {
  label: string;
  icon: LucideIcon;
  folder: EmailFolder;
  pathname: string;
  accountParam: string | null;
  accounts: { email: string; displayName?: string }[];
  getColor: (email: string) => string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const parentHref = emailFolderHref(folder);
  const parentPath = parentHref.split("?")[0]!;
  const parentActive =
    (pathname === parentPath || pathname.startsWith(`${parentPath}/`)) &&
    !accountParam;

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-0.5">
        <Link
          href={parentHref}
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            parentActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{label}</span>
        </Link>
        {accounts.length > 0 ? (
          <button
            type="button"
            aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
          >
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
        ) : null}
      </div>
      {open && accounts.length > 0 ? (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border pl-2">
          {accounts.map((account) => {
            const href = emailFolderHref(folder, account.email);
            const active =
              (pathname === parentPath ||
                pathname.startsWith(`${parentPath}/`)) &&
              accountParam === account.email;
            return (
              <Link
                key={`${folder}:${account.email}`}
                href={href}
                title={account.email}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                )}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getColor(account.email) }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate">{account.email}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmailModeNav({
  onAddAccount,
}: {
  onAddAccount: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { enabledAddresses, getColor } = useMailAccounts();
  const accountParam =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;
  const inCompose =
    pathname === "/email/compose" || pathname.startsWith("/email/compose/");
  const inInbox =
    pathname === "/email/inbox" || pathname.startsWith("/email/inbox/");
  const inSent =
    pathname === "/email/sent" || pathname.startsWith("/email/sent/");
  const inTrash =
    pathname === "/email/trash" || pathname.startsWith("/email/trash/");

  return (
    <div className="flex flex-1 flex-col gap-1">
      {enabledAddresses.length === 0 ? (
        <div className="space-y-2 px-2 py-3">
          <p className="text-xs text-muted-foreground">
            No mail accounts yet. Add an existing domain address to start.
          </p>
          <Button size="sm" className="w-full" onClick={onAddAccount}>
            <Plus className="size-4" />
            Add account
          </Button>
        </div>
      ) : (
        <>
          <FolderTree
            label="Compose"
            icon={Pencil}
            folder="compose"
            pathname={pathname}
            accountParam={accountParam}
            accounts={enabledAddresses}
            getColor={getColor}
            defaultOpen={inCompose}
          />
          <FolderTree
            label="Inbox"
            icon={Inbox}
            folder="inbox"
            pathname={pathname}
            accountParam={accountParam}
            accounts={enabledAddresses}
            getColor={getColor}
            defaultOpen={inInbox}
          />
          <FolderTree
            label="Sent"
            icon={Send}
            folder="sent"
            pathname={pathname}
            accountParam={accountParam}
            accounts={enabledAddresses}
            getColor={getColor}
            defaultOpen={inSent}
          />
          <FolderTree
            label="Trash"
            icon={Trash2}
            folder="trash"
            pathname={pathname}
            accountParam={accountParam}
            accounts={enabledAddresses}
            getColor={getColor}
            defaultOpen={inTrash}
          />
        </>
      )}

      <div className="mt-auto pt-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onAddAccount}
        >
          <Plus className="size-4" />
          Add account
        </Button>
      </div>
    </div>
  );
}

function DashboardModeNav() {
  const pathname = usePathname();
  const { tabs, settingsNav, domains } = useDashboardPaths();
  const domainStore = useDomain();
  const domainsWorking = domainStore.isWorking;
  const inSettings = pathname.startsWith("/settings");

  return (
    <>
      {tabs.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === "/settings"
            ? inSettings
            : isActive(item.href, pathname);

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.href === domains && domainsWorking ? (
                <Loader2
                  className="size-3.5 shrink-0 animate-spin text-muted-foreground"
                  aria-label="Domain setup in progress"
                />
              ) : null}
            </Link>
            {item.href === "/settings" && inSettings ? (
              <div className="ml-3 mt-1 flex flex-col gap-0.5 border-l border-sidebar-border pl-3">
                {settingsNav.map((sub) => {
                  const subActive = isActive(sub.href, pathname);
                  return (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        subActive
                          ? "text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:text-sidebar-foreground",
                      )}
                    >
                      {sub.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export function UserSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = useProductId();
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const mode = useMemo(() => modeFromPathname(pathname), [pathname]);
  const {
    isDesktop,
    dragRegionClassName,
    dragRegionProps,
    noDragClassName,
    macSidebarHeaderClassName,
  } = useDesktopChrome();

  useEffect(() => {
    const query = searchParams.toString();
    const full = query ? `${pathname}?${query}` : pathname;
    writeLastPath(userId, mode, full);
    writeSidebarMode(userId, mode);
  }, [mode, pathname, searchParams, userId]);

  function switchMode(next: SidebarMode) {
    if (next === mode) return;
    writeSidebarMode(userId, next);
    const target = readLastPath(userId, next);
    router.push(
      target ||
        (next === "email" ? DEFAULT_EMAIL_PATH : DEFAULT_DASHBOARD_PATH),
    );
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 shrink-0 select-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div
        {...dragRegionProps}
        className={cn(
          "space-y-3 border-b border-sidebar-border px-4 py-4",
          dragRegionClassName,
          macSidebarHeaderClassName,
        )}
      >
        {isDesktop ? (
          <div
            {...dragRegionProps}
            className={cn(
              "font-semibold tracking-tight text-sidebar-foreground",
              dragRegionClassName,
            )}
          >
            Relaybase
          </div>
        ) : (
          <Link
            href="/dashboard"
            className="font-semibold tracking-tight text-sidebar-foreground"
          >
            Relaybase
          </Link>
        )}
        <div
          className={cn(noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === "email" || value === "dashboard") {
                switchMode(value);
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-y-auto p-3",
          noDragClassName,
        )}
        aria-label={mode === "email" ? "Email" : "Dashboard"}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        {mode === "email" ? (
          <EmailModeNav onAddAccount={() => setAddOpen(true)} />
        ) : (
          <DashboardModeNav />
        )}
      </nav>

      <div
        className={cn(
          "space-y-2 border-t border-sidebar-border px-4 py-3",
          noDragClassName,
        )}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        <p
          className="truncate font-mono text-xs text-muted-foreground"
          title={userId}
        >
          {userId}
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          Sign out
        </button>
      </div>

      <AddEmailAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  );
}
