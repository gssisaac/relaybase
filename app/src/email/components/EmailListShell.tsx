"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Inbox, Search } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  trailing,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex select-none flex-col gap-3 border-b border-border px-4 py-2 sm:flex-row sm:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 border-0 bg-muted/50 pl-8 shadow-none focus-visible:ring-1"
        />
      </div>
      {trailing ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{trailing}</div>
      ) : null}
    </div>
  );
}

export function EmailTableHeader({ children }: { children: ReactNode }) {
  return (
    <div className="grid select-none grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto] gap-3 border-b border-border bg-muted/20 px-4 py-1.5 text-xs font-medium text-muted-foreground sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto_auto]">
      {children}
    </div>
  );
}

export function EmailTableRow({
  href,
  onClick,
  primary,
  secondary,
  subject,
  preview,
  date,
  status,
  selected,
}: {
  href?: string;
  onClick?: () => void;
  primary: string;
  secondary?: string;
  subject: string;
  preview?: string;
  date: string;
  status?: ReactNode;
  selected?: boolean;
}) {
  const className = cn(
    "grid w-full gap-3 border-b border-border px-4 py-2.5 text-left text-sm transition-colors last:border-b-0",
    status
      ? "grid-cols-[1fr_auto_auto] sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)_auto_auto]"
      : "grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto]",
    selected ? "bg-accent/70" : "hover:bg-muted/50",
  );

  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{primary}</p>
        {secondary ? (
          <p className="truncate text-xs text-muted-foreground">{secondary}</p>
        ) : null}
      </div>
      <div className="min-w-0 truncate">
        <span className="font-medium text-foreground">
          {subject || "(no subject)"}
        </span>
        {preview ? (
          <span className="text-muted-foreground">
            {" — "}
            {preview}
          </span>
        ) : null}
      </div>
      {status ? (
        <>
          <span className="hidden text-xs text-muted-foreground sm:block">
            {date}
          </span>
          <div className="flex items-center justify-end gap-2 sm:min-w-[72px]">
            <span className="text-xs text-muted-foreground sm:hidden">
              {date}
            </span>
            {status}
          </div>
        </>
      ) : (
        <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
          {date}
        </span>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

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
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
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
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</h2>
        {actions}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-4">{children}</div>
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
