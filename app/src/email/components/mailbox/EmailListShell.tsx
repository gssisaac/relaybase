"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Inbox, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { memo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOptionalAppShellNav } from "@/components/layout/app-shell-nav";
import { MobileNavTrigger } from "@/components/layout/MobileNavTrigger";
import { useDesktopChrome } from "@/lib/desktop/shell";
import { onDraggableFieldMouseDown } from "@/lib/desktop/shell";
import { cn } from "@/lib/utils";

export function EmailListContainer({
  children,
  plain,
}: {
  children: ReactNode;
  plain?: boolean;
}) {
  if (plain) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    );
  }
  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
      {children}
    </div>
  );
}

/** Sending / Receiving style segment control */
export function SegmentTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            value === opt.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  leading,
  searchTrailing,
  trailing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  leading?: ReactNode;
  /** Rendered at the right end of the search field row (same line as the input). */
  searchTrailing?: ReactNode;
  trailing?: ReactNode;
}) {
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  return (
    <div
      {...dragRegionProps}
      className={cn(
        "flex shrink-0 select-none flex-col gap-3 border-b border-border/30 px-4 py-2 sm:flex-row sm:items-center",
        dragRegionClassName,
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 sm:flex-1",
          dragRegionClassName,
        )}
        {...dragRegionProps}
      >
        <MobileNavTrigger />
        {leading ? (
          <div
            className={cn("flex shrink-0 flex-wrap items-center gap-2", noDragClassName)}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            {leading}
          </div>
        ) : null}
        <div
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2",
            dragRegionClassName,
          )}
          {...dragRegionProps}
        >
          <div
            {...dragRegionProps}
            className={cn("relative min-w-0 flex-1", dragRegionClassName)}
          >
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onMouseDown={onDraggableFieldMouseDown}
              placeholder={searchPlaceholder}
              className="h-8 border-0 bg-secondary/60 pl-8 shadow-none focus-visible:bg-secondary/90 focus-visible:ring-0 focus-visible:border-0"
            />
          </div>
          {searchTrailing ? (
            <div
              className={cn("shrink-0", noDragClassName)}
              {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
            >
              {searchTrailing}
            </div>
          ) : null}
        </div>
      </div>
      {trailing ? (
        <div
          className={cn(
            "flex shrink-0 flex-wrap items-center gap-2",
            noDragClassName,
          )}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Mobile (Gmail-style) pill search bar: menu button opens the nav sheet,
 * 16px input text so iOS Safari does not zoom on focus.
 */
export function MobileListSearchBar({
  search,
  onSearchChange,
  placeholder = "Search in mail",
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}) {
  const nav = useOptionalAppShellNav();

  return (
    <div className="shrink-0 px-3 pb-1 pt-2">
      <div className="flex h-12 items-center gap-1 rounded-full bg-secondary/70 pl-1 pr-2 transition-colors focus-within:bg-secondary">
        {nav?.isMobile ? (
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80 active:bg-foreground/10"
            aria-label="Open menu"
            onClick={nav.openNav}
          >
            <Menu className="size-5" aria-hidden />
          </button>
        ) : (
          <Search
            className="mx-3 size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
        )}
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          enterKeyHint="search"
          autoComplete="off"
          aria-label={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-1 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        {search ? (
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-foreground/10"
            aria-label="Clear search"
            onClick={() => onSearchChange("")}
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Mobile (Gmail-style) three-line mail row: sender + date, subject, preview.
 * Fills its virtualized row slot (`h-full`), so the list controls height.
 */
export const EmailMobileRow = memo(function EmailMobileRow({
  href,
  primary,
  subject,
  stackCount,
  preview,
  date,
  trailing,
  selected,
  unread,
  avatar,
}: {
  href: string;
  primary: ReactNode;
  subject: string;
  stackCount?: number;
  preview?: string;
  date: string;
  /** Icons / badges at the end of the preview line. */
  trailing?: ReactNode;
  selected?: boolean;
  unread?: boolean;
  avatar: ReactNode;
}) {
  const strong = unread ? "font-semibold text-foreground" : "font-normal";
  return (
    <Link
      href={href}
      className={cn(
        "flex h-full w-full items-center gap-3 px-4 text-left outline-none transition-colors active:bg-secondary/60",
        selected && "bg-primary/10",
      )}
    >
      <div className="self-start pt-3.5">{avatar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-baseline gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[15px] leading-6",
              strong,
              !unread && "text-foreground/90",
            )}
          >
            {primary}
            {stackCount != null && stackCount > 1 ? (
              <span className="ml-1.5 text-xs font-normal tabular-nums text-muted-foreground">
                {stackCount}
              </span>
            ) : null}
          </p>
          <span
            className={cn(
              "shrink-0 text-xs tabular-nums",
              unread ? "font-semibold text-foreground" : "text-muted-foreground",
            )}
          >
            {date}
          </span>
        </div>
        <p
          className={cn(
            "truncate text-sm leading-5",
            strong,
            !unread && "text-foreground/90",
          )}
        >
          {subject || "(no subject)"}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-sm leading-5 text-muted-foreground">
            {preview || " "}
          </p>
          {trailing ? (
            <span className="flex shrink-0 items-center gap-1.5">{trailing}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
});

export function EmailTableHeader({ children }: { children: ReactNode }) {
  return (
    <div className="grid select-none grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] items-center gap-3 border-b border-border/30 bg-muted/10 px-4 py-1.5 text-left text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto_auto]">
      {children}
    </div>
  );
}

export const EmailTableRow = memo(function EmailTableRow({
  href,
  onClick,
  onContextMenu,
  onMouseEnter,
  primary,
  secondary,
  subject,
  stackCount,
  subjectAddon,
  preview,
  date,
  status,
  selected,
  unread,
  avatar,
}: {
  href?: string;
  onClick?: () => void;
  onContextMenu?: React.MouseEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  primary: ReactNode;
  secondary?: ReactNode;
  subject: string;
  /** Conversation size — rendered flush against the subject (no gap). */
  stackCount?: number;
  /** Extra bits after stack count (e.g. attachment count). */
  subjectAddon?: string;
  preview?: string;
  date: string;
  status?: ReactNode;
  selected?: boolean;
  unread?: boolean;
  /** Optional sender avatar rendered in place of the unread dot. */
  avatar?: ReactNode;
}) {
  const className = cn(
    "grid w-full gap-3 border-b border-border/20 px-4 py-2 text-left text-sm transition-all last:border-b-0 relative outline-none",
    status
      ? "grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto_auto]"
      : "grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto]",
    selected
      ? "bg-primary/5 text-foreground before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-primary"
      : unread
        ? "bg-background text-foreground hover:bg-secondary/40"
        : "hover:bg-secondary/40 text-muted-foreground hover:text-foreground",
  );

  const body = (
    <>
      <div className="flex min-w-0 items-center gap-2">
        {avatar ?? (
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              unread ? "bg-primary" : "bg-transparent",
            )}
            aria-hidden
          />
        )}
        <div className={cn("min-w-0", unread === false && "dark:opacity-80")}>
          <p
            className={cn(
              "truncate text-foreground",
              unread ? "font-semibold dark:text-white" : "font-normal",
            )}
          >
            {primary}
          </p>
          {secondary ? (
            <p
              className={cn(
                "truncate text-xs text-muted-foreground",
                unread && "dark:text-white/75",
              )}
            >
              {secondary}
            </p>
          ) : null}
        </div>
      </div>
      <div className={cn("min-w-0 truncate", unread === false && "dark:opacity-80")}>
        <span
          className={cn(
            "text-foreground",
            unread ? "font-semibold dark:text-white" : "font-normal",
          )}
        >
          {subject || "(no subject)"}
          {stackCount != null && stackCount > 1 ? (
            <span
              className={cn(
                "font-normal tabular-nums",
                unread ? "text-muted-foreground dark:text-white/70" : "text-muted-foreground",
              )}
            >
              {stackCount}
            </span>
          ) : null}
          {subjectAddon ? (
            <span
              className={cn(
                "font-normal",
                unread ? "text-muted-foreground dark:text-white/70" : "text-muted-foreground",
              )}
            >
              {subjectAddon}
            </span>
          ) : null}
        </span>
        {preview ? (
          <span
            className={cn(
              unread ? "text-muted-foreground dark:text-white/80" : "text-muted-foreground",
            )}
          >
            {" — "}
            {preview}
          </span>
        ) : null}
      </div>
      {status ? (
        <>
          <span
            className={cn(
              "hidden text-xs text-muted-foreground sm:block",
              unread && "dark:text-white/75",
              unread === false && "dark:opacity-80",
            )}
          >
            {date}
          </span>
          <div className="flex items-center justify-end gap-2 sm:min-w-[72px]">
            <span
              className={cn(
                "text-xs text-muted-foreground sm:hidden",
                unread && "dark:text-white/75",
                unread === false && "dark:opacity-80",
              )}
            >
              {date}
            </span>
            {status}
          </div>
        </>
      ) : (
        <span
          className={cn(
            "shrink-0 whitespace-nowrap text-xs text-muted-foreground",
            unread && "dark:text-white/75",
            unread === false && "dark:opacity-80",
          )}
        >
          {date}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={className}
        onContextMenu={onContextMenu}
        onMouseEnter={onMouseEnter}
      >
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={onMouseEnter}
      className={className}
    >
      {body}
    </button>
  );
});

export function DetailView({
  title,
  backHref,
  onBack,
  actions,
  children,
}: {
  title: string;
  backHref?: string;
  onBack?: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { dragRegionClassName, dragRegionProps, noDragClassName, isDesktop } =
    useDesktopChrome();

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div
        {...dragRegionProps}
        className={cn(
          "flex shrink-0 select-none items-center gap-3 border-b border-border/30 px-4 py-2",
          dragRegionClassName,
        )}
      >
        <div
          className={cn("shrink-0", noDragClassName)}
          {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
        >
          {backHref ? (
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              nativeButton={false}
              render={<Link href={backHref} />}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="-ml-2"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          )}
        </div>
        <h2
          {...dragRegionProps}
          className={cn(
            "min-w-0 flex-1 truncate text-sm font-semibold",
            dragRegionClassName,
          )}
        >
          {title}
        </h2>
        {actions ? (
          <div
            className={cn("flex shrink-0 items-center gap-2", noDragClassName)}
            {...(isDesktop ? { "data-tauri-drag-region": "false" } : {})}
          >
            {actions}
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-4 select-text">{children}</div>
    </div>
  );
}

export function EmptyListState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted/50">
        <Icon className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
