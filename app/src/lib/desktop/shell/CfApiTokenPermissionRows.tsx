"use client";

import type { ReactNode } from "react";

import {
  formatCfTokenAccessFix,
  isCfTokenPermissionFailure,
  type CfTokenPermissionCheck,
} from "@/lib/desktop/bridge";
import { cn } from "@/lib/utils";

function Cell({
  children,
  highlight,
  className,
}: {
  children: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center rounded-md px-2.5 py-1.5 text-[13px]",
        highlight
          ? "border border-destructive bg-destructive/10 font-medium text-destructive"
          : "text-foreground",
        className,
      )}
    >
      <span className="truncate">{children}</span>
    </div>
  );
}

export function CfApiTokenPermissionRows({
  checks,
  variant = "errors",
}: {
  checks: readonly CfTokenPermissionCheck[];
  /** errors: only failing rows, red border on access fix. reference: required setup list. */
  variant?: "errors" | "reference";
}) {
  const rows =
    variant === "errors"
      ? checks.filter((check) => isCfTokenPermissionFailure(check.status))
      : checks;

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      {variant === "errors" ? (
        <p className="text-xs text-muted-foreground">
          Change these rows in Cloudflare → API Tokens → this token:
        </p>
      ) : null}
      <div className="space-y-1.5">
        {rows.map((check) => {
          const failing = isCfTokenPermissionFailure(check.status);
          return (
            <div
              key={check.id}
              className="flex gap-1.5"
              aria-label={
                variant === "errors" && failing
                  ? `${check.category} ${check.name}: fix access level`
                  : `${check.category} ${check.name} ${check.requiredAccess}`
              }
            >
              <Cell>{check.category}</Cell>
              <Cell>{check.name}</Cell>
              <Cell highlight={variant === "errors" && failing}>
                {variant === "errors" && failing
                  ? formatCfTokenAccessFix(check)
                  : check.requiredAccess}
              </Cell>
            </div>
          );
        })}
      </div>
    </div>
  );
}
