"use client";

import Link from "next/link";
import { Cloud, Database, HardDrive, Loader2, Server } from "lucide-react";

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
import { settingsTabHref } from "@/console/lib/paths";
import { useConnectionStatus } from "@/lib/dashboard/use-connection-status";
import { resolveWorkerUrl } from "@/lib/desktop/app-session/resolve-worker-url";
import { useAppSession } from "@/lib/desktop/app-session";
import { useOptionalDesktop } from "@/lib/desktop/shell";
import { useDesktopChrome } from "@/lib/desktop/shell";
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

export function ConnectionStatusCards() {
  const { isDesktop } = useDesktopChrome();
  const desktop = useOptionalDesktop();
  const session = useAppSession();
  const { snapshot, loading, refreshing } = useConnectionStatus();

  if (!isDesktop) return null;

  const resolvedWorkerUrl =
    snapshot?.worker?.workerUrl?.trim() ||
    resolveWorkerUrl({
      role: "owner",
      ownerStatus: session.ownerStatus,
      credentials: desktop?.credentials ?? null,
      teamLogin: null,
    });
  const hasWorkerCredentials = Boolean(resolvedWorkerUrl);

  const awaitingConsole =
    session.phase.kind === "ownerReady" && !session.hasConsoleAccess;

  const health = connectionHealthFromSnapshot(snapshot, {
    pending: loading || refreshing || awaitingConsole,
    hasWorkerCredentials,
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CompactConnectionCard
        icon={Cloud}
        title="Server token"
        health={health.cf}
        href={settingsTabHref("cloudflare")}
      />
      <CompactConnectionCard
        icon={Server}
        title="Routing Worker"
        health={health.worker}
        href={settingsTabHref("worker")}
      />
      <CompactConnectionCard
        icon={HardDrive}
        title="Inbound R2"
        health={health.r2}
        href={settingsTabHref("inbound-r2")}
      />
      <CompactConnectionCard
        icon={Database}
        title="D1"
        health={health.d1}
        href={settingsTabHref("d1")}
      />
    </div>
  );
}
