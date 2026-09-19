"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { DomainOnboardingSummary } from "@/lib/dashboard/domain-store";
import {
  cloudflareDomainsOverviewUrl,
  cloudflareZoneDashboardUrl,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";

function CopyNsButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy");
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0 px-2" onClick={() => void copy()}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}

export function DomainNeedSetupPopover({
  domain,
  accountId,
  onboarding,
  children,
}: {
  domain: string;
  accountId: string;
  onboarding: DomainOnboardingSummary;
  children: React.ReactNode;
}) {
  const zoneId = onboarding.zoneId?.trim() ?? "";
  const nameServers = onboarding.nameServers ?? [];
  const isNotFound = onboarding.lastErrorCode === "ZONE_NOT_FOUND";
  const cfUrl = zoneId
    ? cloudflareZoneDashboardUrl(accountId, zoneId)
    : cloudflareDomainsOverviewUrl(accountId);

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={(e) => e.stopPropagation()}
          />
        }
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[min(20rem,calc(100vw-2rem))]">
        <PopoverHeader>
          <PopoverTitle>Domain setup required</PopoverTitle>
          <PopoverDescription className="text-xs leading-relaxed">
            {isNotFound
              ? `Add ${domain} to your Cloudflare account, then return here. Relaybase will detect when the zone is active.`
              : `Change your domain's nameservers at your registrar (where you bought ${domain}) to the Cloudflare nameservers below.`}
          </PopoverDescription>
        </PopoverHeader>

        {nameServers.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Nameservers</p>
            <ul className="space-y-1.5">
              {nameServers.map((ns) => (
                <li
                  key={ns}
                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[11px]"
                >
                  <span className="min-w-0 truncate">{ns}</span>
                  <CopyNsButton value={ns} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {onboarding.cfZoneStatus && onboarding.cfZoneStatus !== "active" ? (
          <p className="text-[11px] text-muted-foreground">
            Cloudflare zone status:{" "}
            <span className="font-medium text-foreground">{onboarding.cfZoneStatus}</span>
          </p>
        ) : null}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1 w-full gap-1.5 text-xs"
          onClick={() => void desktopOpenExternal(cfUrl)}
        >
          Open Cloudflare Dashboard
          <ExternalLink className="size-3.5" />
        </Button>
      </PopoverContent>
    </Popover>
  );
}
