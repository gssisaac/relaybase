"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronsUpDown,
  FilePen,
  Inbox,
  LayoutGrid,
  Loader2,
  LogOut,
  Mail,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useDashboardPaths } from "@/dashboard/paths";
import { AddEmailAccountDialog } from "@/email/components/AddEmailAccountDialog";
import { useEmailMailbox } from "@/email/components/EmailMailboxContext";
import { useMailAccounts } from "@/email/components/MailAccountsContext";
import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  modeFromPathname,
  readLastPath,
  writeLastPath,
  writeSidebarMode,
  type SidebarMode,
} from "@/email/sidebar-mode";
import { emailFolderHref, type EmailFolder } from "@/email/paths";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useDashboardDomain } from "@/dashboard/hooks/useDashboardDomain";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

function UnreadCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  const label = count > 99 ? "99+" : String(count);
  return (
    <span
      className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
      aria-label={`${count} unread`}
    >
      {label}
    </span>
  );
}

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
  collapsed,
  unreadCount = 0,
  unreadCountForAccount,
  onAddAccount,
  onRemoveAccount,
}: {
  label: string;
  icon: LucideIcon;
  folder: EmailFolder;
  pathname: string;
  accountParam: string | null;
  accounts: { email: string; displayName?: string }[];
  getColor: (email: string) => string;
  defaultOpen: boolean;
  collapsed: boolean;
  unreadCount?: number;
  unreadCountForAccount?: (email: string) => number;
  onAddAccount?: () => void;
  onRemoveAccount?: (email: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const parentHref = emailFolderHref(folder);
  const parentPath = parentHref.split("?")[0]!;
  const parentActive =
    (pathname === parentPath || pathname.startsWith(`${parentPath}/`)) &&
    !accountParam;
  const showUnread = folder === "inbox";
  const inboxMenus = folder === "inbox";

  const parentRow = (
    <div className="flex items-center gap-0.5">
      <Link
        href={parentHref}
        title={collapsed ? label : undefined}
        className={cn(
          "relative flex min-w-0 flex-1 items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
          parentActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          collapsed ? "justify-center gap-0" : "gap-2",
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {showUnread ? <UnreadCountBadge count={unreadCount} /> : null}
          </>
        ) : showUnread && unreadCount > 0 ? (
          <span
            className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
            aria-label={`${unreadCount} unread`}
          />
        ) : null}
      </Link>
      {!collapsed && accounts.length > 0 ? (
        <button
          type="button"
          aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        >
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              open ? "rotate-0" : "-rotate-90",
            )}
          />
        </button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-0.5">
      {inboxMenus && onAddAccount ? (
        <ContextMenu>
          <ContextMenuTrigger render={<div className="contents" />}>
            {parentRow}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={onAddAccount}>
              <Plus className="size-3.5" />
              Add account
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ) : (
        parentRow
      )}
      {!collapsed && open && accounts.length > 0 ? (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-sidebar-border/70 pl-2">
          {accounts.map((account) => {
            const href = emailFolderHref(folder, account.email);
            const active =
              (pathname === parentPath || pathname.startsWith(`${parentPath}/`)) &&
              accountParam === account.email;
            const accountUnread = showUnread
              ? (unreadCountForAccount?.(account.email) ?? 0)
              : 0;
            const accountLink = (
              <Link
                href={href}
                title={account.email}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
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
                {accountUnread > 0 ? (
                  <span
                    className="size-2 shrink-0 rounded-full bg-primary"
                    aria-label={`${accountUnread} unread`}
                  />
                ) : null}
              </Link>
            );
            if (!inboxMenus || !onRemoveAccount) {
              return (
                <div key={`${folder}:${account.email}`}>{accountLink}</div>
              );
            }
            return (
              <ContextMenu key={`${folder}:${account.email}`}>
                <ContextMenuTrigger render={<div className="contents" />}>
                  {accountLink}
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => onRemoveAccount(account.email)}
                  >
                    <Trash2 className="size-3.5" />
                    Remove account
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function EmailModeNav({
  onAddAccount,
  collapsed,
}: {
  onAddAccount: () => void;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { enabledAddresses, getColor, removeEnabledAccount } = useMailAccounts();
  const { unreadCount, unreadCountForAccount } = useEmailMailbox();
  const accountParam =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;
  const inCompose =
    pathname === "/email/compose" || pathname.startsWith("/email/compose/");
  const inInbox =
    pathname === "/email/inbox" || pathname.startsWith("/email/inbox/");
  const inDrafts =
    pathname === "/email/drafts" || pathname.startsWith("/email/drafts/");
  const inSent =
    pathname === "/email/sent" || pathname.startsWith("/email/sent/");
  const inTrash =
    pathname === "/email/trash" || pathname.startsWith("/email/trash/");

  function handleRemoveAccount(email: string) {
    // Only drops the address from the mail sidebar enable-list (localStorage).
    // Mail under ~/.relaybase/ is left intact so re-adding restores the view.
    removeEnabledAccount(email);
    if (accountParam?.toLowerCase() === email.toLowerCase()) {
      router.push(emailFolderHref("inbox"));
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      {enabledAddresses.length === 0 ? (
        <div className="space-y-2 px-2 py-2">
          {!collapsed ? (
            <p className="text-[11px] text-muted-foreground">
              No mail accounts yet. Add an existing domain address to start.
            </p>
          ) : null}
          <Button
            size={collapsed ? "icon-sm" : "sm"}
            className={cn(collapsed ? "mx-auto" : "w-full")}
            onClick={onAddAccount}
            title="Add account"
          >
            <Plus className="size-3.5" />
            {!collapsed ? "Add account" : null}
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
            collapsed={collapsed}
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
            collapsed={collapsed}
            unreadCount={unreadCount}
            unreadCountForAccount={unreadCountForAccount}
            onAddAccount={onAddAccount}
            onRemoveAccount={handleRemoveAccount}
          />
          <FolderTree
            label="Drafts"
            icon={FilePen}
            folder="drafts"
            pathname={pathname}
            accountParam={accountParam}
            accounts={enabledAddresses}
            getColor={getColor}
            defaultOpen={inDrafts}
            collapsed={collapsed}
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
            collapsed={collapsed}
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
            collapsed={collapsed}
          />
        </>
      )}
    </div>
  );
}

function DashboardModeNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { tabs, domains, settingsBase } = useDashboardPaths();
  const domainStore = useDomain();
  const { hrefWithDomain } = useDashboardDomain();
  const domainsWorking = domainStore.isWorking;
  const inSettings = pathname.startsWith("/settings");

  return (
    <>
      {tabs.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === settingsBase
            ? inSettings
            : isActive(item.href, pathname);
        const href = hrefWithDomain(item.href);

        return (
          <Link
            key={item.href}
            href={href}
            title={collapsed ? item.label : undefined}
            className={cn(
              "flex items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed ? "justify-center gap-0" : "gap-2",
            )}
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            {!collapsed ? (
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            ) : null}
            {!collapsed && item.href === domains && domainsWorking ? (
              <Loader2
                className="size-3 shrink-0 animate-spin text-muted-foreground"
                aria-label="Domain setup in progress"
              />
            ) : null}
          </Link>
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
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(`relaybase:sidebar-collapsed:${userId}`) === "1";
  });
  const mode = useMemo(() => modeFromPathname(pathname), [pathname]);
  const {
    isDesktop,
    isMacOS,
    dragRegionClassName,
    dragRegionProps,
    noDragClassName,
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

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          `relaybase:sidebar-collapsed:${userId}`,
          next ? "1" : "0",
        );
      }
      return next;
    });
  }

  async function signOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/login");
    router.refresh();
  }

  const modeToggleLabel =
    mode === "email" ? "Switch to dashboard" : "Switch to email";

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 select-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <div
        {...dragRegionProps}
        className={cn(
          "flex shrink-0 flex-col border-b border-sidebar-border",
          dragRegionClassName,
        )}
      >
        {isDesktop && isMacOS ? (
          <div
            aria-hidden
            className="w-full shrink-0"
            style={{ height: 28 }}
          />
        ) : null}
        <div
          className={cn(
            "space-y-2 px-3 py-3",
            noDragClassName,
          )}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          <div className="flex items-center justify-between gap-1">
            <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size={collapsed ? "icon-sm" : "sm"}
                  className={cn(
                    "max-w-full",
                    collapsed ? "px-0" : "justify-start gap-1.5 px-1.5",
                  )}
                  aria-label="Relaybase menu"
                />
              }
            >
              {collapsed ? (
                <LayoutGrid className="size-3.5" />
              ) : (
                <>
                  <span className="truncate text-sm font-semibold tracking-tight">
                    Relaybase
                  </span>
                  <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                </>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" sideOffset={8}>
              <DropdownMenuItem disabled>{userId}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAddOpen(true)}>
                <Plus className="size-3.5" />
                Add account
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  switchMode(mode === "email" ? "dashboard" : "email")
                }
              >
                {mode === "email" ? (
                  <LayoutGrid className="size-3.5" />
                ) : (
                  <Mail className="size-3.5" />
                )}
                {mode === "email" ? "Open dashboard" : "Open email"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => void signOut()}
              >
                <LogOut className="size-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={modeToggleLabel}
            title={modeToggleLabel}
            onClick={() =>
              switchMode(mode === "email" ? "dashboard" : "email")
            }
          >
            {mode === "email" ? (
              <LayoutGrid className="size-3.5" />
            ) : (
              <Mail className="size-3.5" />
            )}
          </Button>
          </div>
        </div>
      </div>

      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-y-auto p-2",
          noDragClassName,
        )}
        aria-label={mode === "email" ? "Email" : "Dashboard"}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        {mode === "email" ? (
          <EmailModeNav
            collapsed={collapsed}
            onAddAccount={() => setAddOpen(true)}
          />
        ) : (
          <DashboardModeNav collapsed={collapsed} />
        )}
      </nav>

      <div
        className={cn("border-t border-sidebar-border p-2", noDragClassName)}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="mx-auto"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <PanelLeftClose className="size-3.5" />
          )}
        </Button>
      </div>

      <AddEmailAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </aside>
  );
}
