"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Download,
  FilePen,
  Inbox,
  Megaphone,
  Loader2,
  LogOut,
  Mails,
  MessageSquare,
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
import { AppUpdateBanner } from "@/console/components/AppUpdateBanner";
import { WorkerUpdateBanner } from "@/console/components/WorkerUpdateBanner";
import { useProductUpdateStatus } from "@/console/hooks/useProductUpdateStatus";
import { SETTINGS_UPDATE_PATH, useDashboardPaths } from "@/console/lib/paths";
import { AddEmailAccountDialog } from "@/email/components/accounts/AddEmailAccountDialog";
import { AddTeamAccountDialog } from "@/email/components/accounts/AddTeamAccountDialog";
import { useEmailMailbox } from "@/email/components/mailbox/EmailMailboxContext";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import {
  modeFromPathname,
  hydrateSidebarState,
  readLastPath,
  readSidebarCollapsed,
  writeLastPath,
  writeSidebarCollapsed,
  writeSidebarMode,
  type SidebarMode,
} from "@/lib/navigation/sidebar-mode";
import {
  composeFeedbackHref,
  composeNewHref,
  FEEDBACK_TO_EMAIL,
} from "@/email/lib/compose/compose-open";
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
import { Badge } from "@/components/ui/badge";
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
import { useScalePaths } from "@/scale/lib/paths";
import { SendingWarningIcon } from "@/console/components/SendingWarningIcon";
import { useDashboardDomain } from "@/console/hooks/useDashboardDomain";
import { useDomain } from "@/lib/dashboard/DomainContext";
import { useSendingHealth } from "@/lib/dashboard/SendingHealthContext";
import { useMailRuntime } from "@/mail-platform/runtime";
import { useAppSession } from "@/lib/desktop/app-session";
import {
  signOutRedirectPath,
  signOutRelaybase,
} from "@/lib/desktop/auth";
import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";
import { Settings } from "lucide-react";

/** Matches the product mail mark (orange), as a Lucide stroke — Mailbox & Scale. */
const MODE_TITLE_ICON_COLOR = "#D8663B";

function OfflineSidebarBadge({ collapsed }: { collapsed: boolean }) {
  const session = useAppSession();
  const [browserOffline, setBrowserOffline] = useState(
    () => typeof navigator !== "undefined" && navigator.onLine === false,
  );

  useEffect(() => {
    function sync() {
      setBrowserOffline(navigator.onLine === false);
    }
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!session.workerUnreachable && !browserOffline) return null;
  return (
    <Badge
      variant="outline"
      className="max-w-full"
      aria-label="Offline"
      title="No connection to your Worker"
    >
      {collapsed ? "Off" : "Offline"}
    </Badge>
  );
}

function ModeIcon({
  mode,
  className,
}: {
  mode: SidebarMode;
  className?: string;
}) {
  const accentIconProps = {
    className: cn("size-4 shrink-0", className),
    style: { color: MODE_TITLE_ICON_COLOR },
    "aria-hidden": true as const,
  };

  if (mode === "email") {
    return <Mails {...accentIconProps} />;
  }
  if (mode === "scale") {
    return <Megaphone {...accentIconProps} />;
  }
  return (
    <img
      src="/icon.png"
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0", className)}
    />
  );
}

function TitleIcon({ mode }: { mode: SidebarMode }) {
  return <ModeIcon mode={mode} />;
}

function sidebarTitleForMode(mode: SidebarMode) {
  if (mode === "email") return "Mailbox";
  if (mode === "scale") return "Scale";
  return "Console";
}

function ModeMenuItem({
  label,
  mode,
  active,
  onClick,
}: {
  label: string;
  mode: SidebarMode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <DropdownMenuItem onClick={onClick}>
      <ModeIcon mode={mode} className="size-3.5" />
      <span className="flex-1">{label}</span>
      <Check
        className={cn("ml-auto size-3.5", active ? "opacity-100" : "opacity-0")}
        aria-hidden
      />
    </DropdownMenuItem>
  );
}

function TitleMenuItems({
  mode,
  teamMode,
  canAddAccount = true,
  onAddAccount,
  onOpenSettings,
  onSwitchTo,
  onSignOut,
}: {
  mode: SidebarMode;
  teamMode: boolean;
  canAddAccount?: boolean;
  onAddAccount: () => void;
  onOpenSettings: () => void;
  onSwitchTo: (mode: SidebarMode) => void;
  onSignOut: () => void;
}) {
  return (
    <>
      <ModeMenuItem
        label="Mailbox"
        mode="email"
        active={mode === "email"}
        onClick={() => onSwitchTo("email")}
      />
      <ModeMenuItem
        label="Scale"
        mode="scale"
        active={mode === "scale"}
        onClick={() => onSwitchTo("scale")}
      />
      {teamMode ? null : (
        <ModeMenuItem
          label="Console"
          mode="dashboard"
          active={mode === "dashboard"}
          onClick={() => onSwitchTo("dashboard")}
        />
      )}
      <div role="separator" className="my-1 h-px bg-border" />
      {mode === "email" ? (
        <DropdownMenuItem onClick={onAddAccount} disabled={!canAddAccount}>
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
  canAddAccount = true,
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
  canAddAccount?: boolean;
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
  const sendingHealth = useSendingHealth();
  const showUnread = folder === "inbox";
  const inboxMenus = folder === "inbox";
  const folderHasSendingWarning = accounts.some((account) =>
    sendingHealth.hasWarningForEmail(account.email),
  );

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
            {folderHasSendingWarning ? (
              <AlertTriangle
                className="size-3 shrink-0 text-amber-600 dark:text-amber-400"
                aria-label="An account has a sending restriction"
              />
            ) : null}
            {showUnread ? <UnreadCountBadge count={unreadCount} /> : null}
          </>
        ) : (
          <>
            {folderHasSendingWarning ? (
              <span
                className="absolute right-1 bottom-1 size-1.5 rounded-full bg-amber-500"
                aria-label="An account has a sending restriction"
              />
            ) : null}
            {showUnread && unreadCount > 0 ? (
              <span
                className="absolute right-1 top-1 size-1.5 rounded-full bg-primary"
                aria-label={`${unreadCount} unread`}
              />
            ) : null}
          </>
        )}
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
            <ContextMenuItem onClick={onAddAccount} disabled={!canAddAccount}>
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
              <div className="flex items-center gap-0.5">
                <Link
                  href={href}
                  title={account.email}
                  className={cn(
                    "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
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
                <SendingWarningIcon
                  size="sm"
                  entry={sendingHealth.statusForEmail(account.email)}
                />
              </div>
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

function EmailModeNavSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-2">
      {Array.from({ length: collapsed ? 4 : 5 }).map((_, index) => (
        <div
          key={index}
          className={cn(
            "animate-pulse rounded-md bg-muted/70",
            collapsed ? "mx-auto size-8" : "h-7 w-full",
          )}
          aria-hidden
        />
      ))}
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
  const {
    availableAddresses,
    enabledAddresses,
    getColor,
    removeEnabledAccount,
    phase: accountsPhase,
  } = useMailAccounts();
  const { unreadCount, unreadCountForAccount, phase: mailPhase } = useEmailMailbox();
  const accountsReady = accountsPhase === "done";
  const mailReady = mailPhase === "done";
  const showUnread = mailReady;
  const accountParam =
    searchParams.get("account")?.trim() ||
    searchParams.get("from")?.trim() ||
    null;
  const inCompose =
    pathname === "/compose" ||
    pathname.startsWith("/compose/") ||
    pathname === "/email/compose" ||
    pathname.startsWith("/email/compose/");
  const inInbox =
    pathname === "/inbox" ||
    pathname.startsWith("/inbox/") ||
    pathname === "/email/inbox" ||
    pathname.startsWith("/email/inbox/");
  const inDrafts =
    pathname === "/drafts" ||
    pathname.startsWith("/drafts/") ||
    pathname === "/email/drafts" ||
    pathname.startsWith("/email/drafts/");
  const inSent =
    pathname === "/sent" ||
    pathname.startsWith("/sent/") ||
    pathname === "/email/sent" ||
    pathname.startsWith("/email/sent/");
  const inTrash =
    pathname === "/trash" ||
    pathname.startsWith("/trash/") ||
    pathname === "/email/trash" ||
    pathname.startsWith("/email/trash/");

  function handleRemoveAccount(email: string) {
    // Only drops the address from the mail sidebar enable-list (~/.relaybase ui).
    // Mail under ~/.relaybase/mail is left intact so re-adding restores the view.
    removeEnabledAccount(email);
    if (accountParam?.toLowerCase() === email.toLowerCase()) {
      router.push(emailFolderHref("inbox"));
    }
  }

  const hasAvailableAccounts = availableAddresses.length > 0;
  const enabledSet = useMemo(
    () => new Set(enabledAddresses.map((a) => a.email.toLowerCase())),
    [enabledAddresses],
  );
  const canAddMoreAccounts = availableAddresses.some(
    (a) => !enabledSet.has(a.email.toLowerCase()),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {!accountsReady ? (
        <EmailModeNavSkeleton collapsed={collapsed} />
      ) : enabledAddresses.length === 0 ? (
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
            disabled={!hasAvailableAccounts}
            title={
              hasAvailableAccounts
                ? "Add account"
                : "No domain addresses available"
            }
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
            unreadCount={showUnread ? unreadCount : 0}
            unreadCountForAccount={
              showUnread ? unreadCountForAccount : () => 0
            }
            canAddAccount={canAddMoreAccounts}
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

function SendFeedbackButton({
  collapsed,
  account,
}: {
  collapsed: boolean;
  account?: string | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = composeFeedbackHref(account);
  const to = searchParams.get("to")?.trim().toLowerCase();
  const inCompose =
    pathname === "/compose" ||
    pathname.startsWith("/compose/") ||
    pathname === "/email/compose" ||
    pathname.startsWith("/email/compose/");
  const active = inCompose && to === FEEDBACK_TO_EMAIL;

  return (
    <Link
      href={href}
      title={collapsed ? "Send feedback" : undefined}
      aria-label="Send feedback"
      className={cn(
        "flex items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        collapsed ? "justify-center gap-0" : "gap-2",
      )}
    >
      <MessageSquare className="size-3.5 shrink-0" aria-hidden />
      {!collapsed ? (
        <span className="min-w-0 flex-1 truncate">Send feedback</span>
      ) : null}
    </Link>
  );
}

function UpdateNavBadge() {
  const { anyUpdateAvailable, loading } = useProductUpdateStatus();
  if (loading || !anyUpdateAvailable) return null;
  return (
    <span
      className="size-2 shrink-0 rounded-full bg-red-500"
      aria-label="Update available"
    />
  );
}

function DashboardModeNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { tabs, domains, settingsBase } = useDashboardPaths();
  const domainStore = useDomain();
  const { hrefWithDomain } = useDashboardDomain();
  const domainsWorking = domainStore.isWorking;
  const inSettings = pathname.startsWith("/settings");
  const inUpdate =
    pathname === SETTINGS_UPDATE_PATH ||
    pathname.startsWith("/settings/worker/update") ||
    pathname.startsWith("/settings/worker/progress");

  return (
    <>
      {tabs.map((item) => {
        const Icon = item.icon;
        const active =
          item.href === settingsBase
            ? inSettings && !inUpdate
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
      <Link
        href={hrefWithDomain(SETTINGS_UPDATE_PATH)}
        title={collapsed ? "Update" : undefined}
        className={cn(
          "flex items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
          inUpdate
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          collapsed ? "justify-center gap-0" : "gap-2",
        )}
      >
        <Download className="size-3.5 shrink-0" aria-hidden />
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 truncate">Update</span>
            <UpdateNavBadge />
          </>
        ) : null}
      </Link>
    </>
  );
}

function ScaleModeNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { tabs } = useScalePaths();

  return (
    <>
      {tabs.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
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
          </Link>
        );
      })}
    </>
  );
}

export function UserSidebar({
  teamMode = false,
  presentation = "docked",
}: {
  teamMode?: boolean;
  presentation?: "docked" | "sheet";
} = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = useProductId();
  const router = useRouter();
  const { session: mailSession } = useMailRuntime();
  const session = useAppSession();
  const { settings: settingsHref } = useEmailPaths();
  const isTeam = teamMode || mailSession.isTeamMode;
  const { availableAddresses, enabledAccounts } = useMailAccounts();
  const enabledSet = useMemo(
    () => new Set(enabledAccounts.map((e) => e.toLowerCase())),
    [enabledAccounts],
  );
  const canAddAccount =
    isTeam ||
    availableAddresses.some((a) => !enabledSet.has(a.email.toLowerCase()));
  const [addOpen, setAddOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readSidebarCollapsed(userId),
  );
  const detectedMode = useMemo(() => modeFromPathname(pathname), [pathname]);
  // Team mode can reach Email and Scale, never Console — fall back to email
  // even on a dashboard URL (team users can't reach those routes anyway).
  const mode: SidebarMode = isTeam
    ? detectedMode === "scale"
      ? "scale"
      : "email"
    : detectedMode;
  const {
    isDesktop,
    isMacOS,
    dragRegionClassName,
    dragRegionProps,
    noDragClassName,
  } = useDesktopChrome();
  const macDesktopChrome = isDesktop && isMacOS;
  const isSheet = presentation === "sheet";
  const sidebarCollapsed = isSheet ? false : collapsed;

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

  async function switchMode(next: SidebarMode) {
    if (next === mode) return;
    if (next === "dashboard" && !isTeam) {
      const unlocked = await session.ensureConsoleAccess();
      if (!unlocked && !session.consoleGateOpen) return;
    }
    writeSidebarMode(userId, next);
    router.push(readLastPath(userId, next));
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
      if (!mailSession.isDesktop) {
        await mailSession.logout();
        await signOutRelaybase(isTeam, session);
        router.replace("/login");
      } else {
        await signOutRelaybase(isTeam, session);
        router.replace(signOutRedirectPath(isTeam, session));
      }
    } catch {
      router.replace(
        mailSession.isDesktop ? signOutRedirectPath(isTeam, session) : "/login",
      );
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

  const titleLabel = sidebarTitleForMode(mode);

  return (
    <aside
      className={cn(
        "flex h-full min-h-0 shrink-0 select-none flex-col overflow-hidden bg-sidebar text-sidebar-foreground transition-[width] duration-300 ease-out",
        isSheet
          ? "w-full border-0"
          : cn(
              "border-r border-sidebar-border",
              sidebarCollapsed ? "w-14" : "w-52",
            ),
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
        <div className={sidebarCollapsed ? "hidden" : "contents"}>
          <SidebarHistoryNav collapsed={sidebarCollapsed} />
        </div>
        {sidebarCollapsed && !isSheet ? (
          <div
            className={cn(
              "flex flex-col items-center gap-0.5 px-1 pt-8 pb-2",
              noDragClassName,
            )}
            data-tauri-drag-region="false"
          >
            <OfflineSidebarBadge collapsed />
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
                  canAddAccount={canAddAccount}
                  onAddAccount={() => setAddOpen(true)}
                  onOpenSettings={openSettings}
                  onSwitchTo={switchMode}
                  onSignOut={() => setSignOutOpen(true)}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <>
            {macDesktopChrome && !isSheet ? (
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
            ) : null}
            <div
              className={cn("space-y-2 px-3 py-3", noDragClassName)}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              <OfflineSidebarBadge collapsed={false} />
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
                      canAddAccount={canAddAccount}
                      onAddAccount={() => setAddOpen(true)}
                      onOpenSettings={openSettings}
                      onSwitchTo={switchMode}
                      onSignOut={() => setSignOutOpen(true)}
                    />
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="flex shrink-0 items-center gap-0.5">
                  {macDesktopChrome || isSheet ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      aria-label="Collapse sidebar"
                      title="Collapse sidebar"
                      onClick={toggleCollapsed}
                    >
                      <PanelLeftClose />
                    </Button>
                  )}
                </div>
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
        aria-label={titleLabel}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        {mode === "email" ? (
          <EmailModeNav
            collapsed={sidebarCollapsed}
            onAddAccount={() => setAddOpen(true)}
          />
        ) : mode === "scale" ? (
          <ScaleModeNav collapsed={sidebarCollapsed} />
        ) : (
          <DashboardModeNav collapsed={sidebarCollapsed} />
        )}
      </nav>

      {!sidebarCollapsed ? <AppUpdateBanner /> : null}

      {!isTeam && mode === "dashboard" && !sidebarCollapsed ? (
        <WorkerUpdateBanner />
      ) : null}

      <div
        className={cn("shrink-0 border-t border-sidebar-border p-2", noDragClassName)}
        {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
      >
        <SendFeedbackButton
          collapsed={sidebarCollapsed}
          account={
            searchParams.get("account")?.trim() ||
            searchParams.get("from")?.trim() ||
            null
          }
        />
      </div>

      {isTeam && mailSession.workerUrl ? (
        <AddTeamAccountDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          workerUrl={mailSession.workerUrl}
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
