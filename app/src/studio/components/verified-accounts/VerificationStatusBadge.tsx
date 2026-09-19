"use client";

import { Badge } from "@/components/ui/badge";
import type { VerificationStatus } from "@/studio/stores/verified-accounts";
import { cn } from "@/lib/utils";

const STYLE: Record<
  VerificationStatus,
  { label: string; className: string; title: string }
> = {
  verified: {
    label: "Verified",
    className:
      "border-emerald-600/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    title: "Cloudflare verified — sends do not use daily quota",
  },
  pending: {
    label: "Pending",
    className:
      "border-amber-600/35 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    title: "Verification email sent — waiting for link click",
  },
  unverified: {
    label: "Unverified",
    className: "border-border bg-muted text-muted-foreground",
    title: "Not registered as a Cloudflare destination address",
  },
};

export function VerificationStatusBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  const meta = STYLE[status];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", meta.className, className)}
      title={meta.title}
    >
      {meta.label}
    </Badge>
  );
}
