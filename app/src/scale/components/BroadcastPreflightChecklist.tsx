"use client";

import { AlertCircle, CheckCircle2, CircleAlert } from "lucide-react";
import Link from "next/link";

import type { PreflightCheck } from "@/scale/lib/broadcast-preflight";
import { broadcastDetailHref } from "@/scale/lib/paths";
import { cn } from "@/lib/utils";

function Icon({ status }: { status: PreflightCheck["status"] }) {
  if (status === "pass") {
    return <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (status === "fail") {
    return <CircleAlert className="size-3.5 shrink-0 text-destructive" />;
  }
  return <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />;
}

export function BroadcastPreflightChecklist({
  checks,
  broadcastId,
  compact,
}: {
  checks: PreflightCheck[];
  broadcastId: string;
  compact?: boolean;
}) {
  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;

  return (
    <div className={cn("space-y-2", compact ? "" : "rounded-md border border-border bg-muted/20 p-2.5")}>
      {!compact ? (
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-foreground">Pre-flight checklist</p>
          <p className="text-[10px] text-muted-foreground">
            {failCount ? `${failCount} block` : null}
            {failCount && warnCount ? " · " : null}
            {warnCount ? `${warnCount} warn` : null}
            {!failCount && !warnCount ? "Ready" : null}
          </p>
        </div>
      ) : null}
      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.id} className="flex gap-2 text-[11px] leading-snug">
            <Icon status={check.status} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">{check.label}</p>
              {check.detail ? (
                <p className="text-muted-foreground">{check.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {(failCount > 0 || warnCount > 0) && !compact ? (
        <Link
          href={broadcastDetailHref(broadcastId, "settings")}
          className="inline-block text-[11px] text-primary hover:underline"
        >
          Open Settings (compliance & sender)
        </Link>
      ) : null}
    </div>
  );
}
