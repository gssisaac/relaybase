"use client";

import { Loader2, Pencil, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { HealthTone } from "@/lib/dashboard/connection-status";
import { cn } from "@/lib/utils";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (trimmed.length <= 12) return "••••••••••••";
  return `${trimmed.slice(0, 6)}${"•".repeat(14)}${trimmed.slice(-4)}`;
}

export function HealthStatus({
  tone,
  label,
  detail,
}: {
  tone: HealthTone;
  label: string;
  detail?: string;
}) {
  return (
    <div className="flex items-start gap-2">
      {tone === "pending" ? (
        <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <span
          className={cn(
            "mt-1 size-2.5 shrink-0 rounded-full",
            tone === "ok" && "bg-emerald-500",
            tone === "bad" && "bg-red-500",
            tone === "neutral" && "bg-muted-foreground/40",
          )}
          aria-hidden
        />
      )}
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            tone === "ok" && "text-emerald-700 dark:text-emerald-400",
            tone === "bad" && "text-red-700 dark:text-red-400",
            (tone === "pending" || tone === "neutral") && "text-foreground",
          )}
        >
          {label}
        </p>
        {detail ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ConnectionCard({
  icon: Icon,
  title,
  description,
  editing,
  onEdit,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <CardTitle className="text-sm">{title}</CardTitle>
          {!editing ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-muted-foreground"
              onClick={onEdit}
            >
              <Pencil className="size-3" />
              Edit
            </Button>
          ) : null}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-all font-mono text-xs text-foreground">
        {value}
      </p>
    </div>
  );
}

export function SettingsPageBody({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">{children}</div>
  );
}

/** Included R2 storage on Workers Paid — same reference cap as D1 bars. */
export const R2_INBOUND_SIZE_LIMIT_BYTES = 10 * 1024 ** 3;

export function StorageUsageBar({
  usedBytes,
  limitBytes,
  pending,
  truncated,
}: {
  usedBytes: number | null;
  limitBytes: number;
  pending?: boolean;
  truncated?: boolean;
}) {
  const pct =
    usedBytes != null && limitBytes > 0
      ? Math.min(100, (usedBytes / limitBytes) * 100)
      : 0;

  const usedLabel =
    usedBytes != null
      ? `${formatBytes(usedBytes)}${truncated ? "+" : ""}`
      : null;

  return (
    <div className="space-y-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: pending ? "0%" : `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {pending
          ? "Measuring…"
          : usedLabel != null
            ? `${usedLabel} / ${formatBytes(limitBytes)}`
            : "—"}
      </p>
    </div>
  );
}

export function StorageBindingCard({
  icon: Icon,
  title,
  description,
  status,
  resourceLabel,
  resourceName,
  binding,
  usedBytes,
  limitBytes,
  pending,
  truncated,
  footer,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  status: { tone: HealthTone; label: string; detail: string };
  resourceLabel: string;
  resourceName: string;
  binding: string;
  usedBytes: number | null;
  limitBytes: number;
  pending?: boolean;
  truncated?: boolean;
  footer?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <HealthStatus {...status} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">{resourceLabel}</p>
            <p className="mt-0.5 font-mono text-xs">{resourceName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Binding</p>
            <p className="mt-0.5 font-mono text-xs">{binding}</p>
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Storage</p>
          <StorageUsageBar
            usedBytes={usedBytes}
            limitBytes={limitBytes}
            pending={pending}
            truncated={truncated}
          />
        </div>
        {footer}
      </CardContent>
    </Card>
  );
}
