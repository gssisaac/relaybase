"use client";

import Link from "next/link";
import { Cloud, HardDrive, Loader2, Server } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  connectionHealthFromSnapshot,
  type HealthStatus,
  type HealthTone,
} from "@/lib/dashboard/connection-status";
import { useConnectionStatus } from "@/lib/dashboard/use-connection-status";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";
import { useDesktopChrome } from "@/lib/desktop/use-desktop-chrome";
import { cn } from "@/lib/utils";

function StatusDot({ tone }: { tone: HealthTone }) {
  if (tone === "pending") {
    return (
      <Loader2
        className="size-3.5 shrink-0 animate-spin text-muted-foreground"
        aria-hidden
      />
    );
  }
  return (
    <span
      className={cn(
        "size-2.5 shrink-0 rounded-full",
        tone === "ok" && "bg-emerald-500",
        tone === "bad" && "bg-red-500",
        tone === "neutral" && "bg-muted-foreground/40",
      )}
      aria-hidden
    />
  );
}

function CompactConnectionCard({
  icon: Icon,
  title,
  health,
  href,
}: {
  icon: typeof Cloud;
  title: string;
  health: HealthStatus;
  href: string;
}) {
  return (
    <Card className="transition-colors hover:bg-accent/30">
      <Link href={href} className="block">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <CardTitle className="text-sm">{title}</CardTitle>
          </div>
          <CardDescription className="line-clamp-2">
            {health.detail}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <StatusDot tone={health.tone} />
            <p
              className={cn(
                "text-sm font-medium",
                health.tone === "ok" && "text-emerald-700 dark:text-emerald-400",
                health.tone === "bad" && "text-red-700 dark:text-red-400",
              )}
            >
              {health.label}
            </p>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

export function ConnectionStatusCards({ settingsHref }: { settingsHref: string }) {
  const { isDesktop } = useDesktopChrome();
  const desktop = useOptionalDesktop();
  const { snapshot, loading, refreshing } = useConnectionStatus();

  if (!isDesktop) return null;

  const hasWorkerCredentials = Boolean(
    desktop?.credentials?.workerUrl?.trim() &&
      desktop?.credentials?.adminToken?.trim(),
  );

  const health = connectionHealthFromSnapshot(snapshot, {
    pending: loading || refreshing,
    hasWorkerCredentials,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <CompactConnectionCard
        icon={Cloud}
        title="Cloudflare"
        health={health.cf}
        href={settingsHref}
      />
      <CompactConnectionCard
        icon={Server}
        title="Routing Worker"
        health={health.worker}
        href={settingsHref}
      />
      <CompactConnectionCard
        icon={HardDrive}
        title="Inbound R2"
        health={health.r2}
        href={settingsHref}
      />
    </div>
  );
}
