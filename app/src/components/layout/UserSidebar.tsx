"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronDown,
  FilePen,
  Inbox,
  LayoutGrid,
  Loader2,
  LogOut,
  Mails,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Send,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { SidebarHistoryNav } from "@/components/layout/SidebarHistoryNav";
import { WorkerUpdateBanner } from "@/console/components/WorkerUpdateBanner";
import { useDashboardPaths } from "@/console/lib/paths";
import { AddEmailAccountDialog } from "@/email/components/accounts/AddEmailAccountDialog";
import { AddTeamAccountDialog } from "@/email/components/accounts/AddTeamAccountDialog";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import {
  DEFAULT_DASHBOARD_PATH,
  DEFAULT_EMAIL_PATH,
  modeFromPathname,
  hydrateSidebarState,
  readLastPath,
  readSidebarCollapsed,
  writeLastPath,
  writeSidebarCollapsed,
  writeSidebarMode,
  type SidebarMode,
} from "@/lib/navigation/sidebar-mode";
import { composeNewHref } from "@/email/lib/compose/compose-open";
import { emailFolderHref, useEmailPaths, type EmailFolder } from "@/email/lib/paths";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useDashboardDomain } from "@/console/hooks/useDashboardDomain";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useDesktop } from "@/lib/desktop/shell";
import {
  signOutRedirectPath,
  signOutRelaybase,
} from "@/lib/desktop/auth";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

/** Matches the product mail mark (orange), as a Lucide stroke. */
const MAILBOX_TITLE_ICON_COLOR = "#D8663B";

function TitleIcon({ mode }: { mode: SidebarMode }) {
  if (mode === "email") {
    return (
      <Mails
        className="size-4 shrink-0"
        style={{ color: MAILBOX_TITLE_ICON_COLOR }}
        aria-hidden
      />
    );
  }
  return (
    <img
      src="/icon.png"
      alt=""
      width={16}
      height={16}
      className="size-4 shrink-0"
    />
  );
}

function TitleMenuItems({
  mode,
  teamMode,
  onAddAccount,
  onOpenSettings,
  onSwitchMode,
  onSignOut,
}: {
  mode: SidebarMode;
  teamMode: boolean;
  onAddAccount: () => void;
  onOpenSettings: () => void;
  onSwitchMode: () => void;
  onSignOut: () => void;
}) {
  return (
    <>
      {mode === "email" ? (
        <DropdownMenuItem onClick={onAddAccount}>
          <Plus className="size-3.5" />
          Add account
        </DropdownMenuItem>
      ) : null}
      {mode === "email" ? (
        <DropdownMenuItem onClick={onOpenSettings}>
          <Settings className="size-3.5" />
          Settings
        </DropdownMenuItem>
      ) : null}
      {teamMode ? null : (
        <DropdownMenuItem onClick={onSwitchMode}>
          {mode === "email" ? (
            <LayoutGrid className="size-3.5" />
          ) : (
            <Mails className="size-3.5" />
          )}
          {mode === "email" ? "Open dashboard" : "Open mailbox"}
        </DropdownMenuItem>
      )}
      <DropdownMenuItem variant="destructive" onClick={onSignOut}>
        <LogOut className="size-3.5" />
        Sign out
      </DropdownMenuItem>
    </>
  );
}

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
  folder: Exclude<EmailFolder, "settings">;
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
  const parentHref =
    folder === "compose" ? composeNewHref() : emailFolderHref(folder);
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
            const href =
              folder === "compose"
                ? composeNewHref(account.email)
                : emailFolderHref(folder, account.email);
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
    // Only drops the address from the mail sidebar enable-list (~/.relaybase ui).
    // Mail under ~/.relaybase/mail is left intact so re-adding restores the view.
    removeEnabledAccount(email);
    if (accountParam?.toLowerCase() === email.toLowerCase()) {
      router.push(emailFolderHref("inbox"));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
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

export function UserSidebar({ teamMode = false }: { teamMode?: boolean } = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = useProductId();
  const router = useRouter();
  const { teamLogin, refresh: refreshDesktop } = useDesktop();
  const { settings: settingsHref } = useEmailPaths();
  const isTeam = teamMode || Boolean(teamLogin);
  const [addOpen, setAddOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readSidebarCollapsed(userId),
  );
  const detectedMode = useMemo(() => modeFromPathname(pathname), [pathname]);
  // Team mode is locked to email — never show dashboard nav even on a
  // dashboard URL (team users can't reach those routes anyway).
  const mode: SidebarMode = isTeam ? "email" : detectedMode;
  const {
    isDesktop,
    dragRegionClassName,
    dragRegionProps,
    noDragClassName,
  } = useDesktopChrome();

  useEffect(() => {
    let cancelled = false;
    void hydrateSidebarState(userId).then((state) => {
      if (!cancelled) setCollapsed(state.collapsed);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
      writeSidebarCollapsed(userId, next);
      return next;
    });
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOutRelaybase(isTeam);
      await refreshDesktop();
      router.replace(signOutRedirectPath(isTeam));
    } catch {
      /* redirect anyway on partial clear */
      router.replace(signOutRedirectPath(isTeam));
    } finally {
      setSigningOut(false);
      setSignOutOpen(false);
    }
  }

  function openSettings() {
    const account =
      searchParams.get("account")?.trim() ||
      searchParams.get("from")?.trim() ||
      null;
    const href = account
      ? `${settingsHref}?account=${encodeURIComponent(account)}`
      : settingsHref;
    router.push(href);
  }

  const titleLabel = mode === "email" ? "Mailbox" : "Relaybase console";
  const modeToggleLabel =
    mode === "email" ? "Switch to dashboard" : "Switch to mailbox";
  const switchModeTarget = () =>
    switchMode(mode === "email" ? "dashboard" : "email");

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 select-none flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        collapsed ? "w-14" : "w-52",
      )}
    >
      <div
        {...dragRegionProps}
        className={cn(
          "relative flex shrink-0 flex-col border-b border-sidebar-border",
          dragRegionClassName,
        )}
      >
        {/* Keep mounted for ⌘[ / ⌘] even when compact hides the buttons. */}
        <div className={collapsed ? "hidden" : "contents"}>
          <SidebarHistoryNav collapsed={collapsed} />
        </div>
        {collapsed ? (
          <div
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 pt-8 pb-2",
              noDragClassName,
            )}
            data-tauri-drag-region="false"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label="Expand sidebar"
              title="Expand sidebar"
              onClick={toggleCollapsed}
            >
              <PanelLeftOpen />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={modeToggleLabel}
              title={modeToggleLabel}
              onClick={switchModeTarget}
              hidden={isTeam}
            >
              <ArrowLeftRight />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 focus-visible:border-transparent focus-visible:ring-0"
                    aria-label={`${titleLabel} menu`}
                  />
                }
              >
                <TitleIcon mode={mode} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" sideOffset={8}>
                <TitleMenuItems
                  mode={mode}
                  teamMode={isTeam}
                  onAddAccount={() => setAddOpen(true)}
                  onOpenSettings={openSettings}
                  onSwitchMode={switchModeTarget}
                  onSignOut={() => setSignOutOpen(true)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "fixed top-1 left-[84px] z-20 shrink-0",
                noDragClassName,
              )}
              data-tauri-drag-region="false"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              onClick={toggleCollapsed}
            >
              <PanelLeftClose />
            </Button>
            <div
              className={cn("space-y-2 px-3 py-3", noDragClassName)}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              <div className="flex items-center justify-between gap-1">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="max-w-full justify-start gap-1.5 px-1.5 focus-visible:border-transparent focus-visible:ring-0"
                        aria-label={`${titleLabel} menu`}
                        tabIndex={-1}
                        onMouseDown={(event) => event.preventDefault()}
                      />
                    }
                  >
                    <TitleIcon mode={mode} />
                    <span className="truncate text-sm font-semibold tracking-tight">
                      {titleLabel}
                    </span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={8}>
                    <TitleMenuItems
                      mode={mode}
                      teamMode={isTeam}
                      onAddAccount={() => setAddOpen(true)}
                      onOpenSettings={openSettings}
                      onSwitchMode={switchModeTarget}
                      onSignOut={() => setSignOutOpen(true)}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={modeToggleLabel}
                  title={modeToggleLabel}
                  onClick={switchModeTarget}
                  hidden={isTeam}
                >
                  <ArrowLeftRight className="size-3.5" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      <nav
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-2",
          noDragClassName,
        )}
        aria-label={mode === "email" ? "Mailbox" : "Dashboard"}
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

      {!isTeam && mode === "dashboard" && !collapsed ? (
        <WorkerUpdateBanner />
      ) : null}

      {isTeam && teamLogin ? (
        <AddTeamAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          workerUrl={teamLogin.workerUrl}
        />
      ) : (
        <AddEmailAccountDialog open={addOpen} onOpenChange={setAddOpen} />
      )}

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out of Relaybase?</AlertDialogTitle>
            <AlertDialogDescription>
              {isTeam
                ? "Clears your team login from this device and returns you to the sign-in page."
                : "Clears your credentials from this device and returns you to the welcome screen."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
