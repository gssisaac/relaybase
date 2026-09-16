"use client";

import { ExternalLink, ShieldCheck } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Quota-free sends to Cloudflare verified destination addresses. */
export const CF_VERIFIED_DESTINATIONS_LIMITS_URL =
  "https://developers.cloudflare.com/email-service/platform/limits/#verified-destination-addresses";

export function VerifiedAccountsQuotaCard({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "border-emerald-600/30 bg-emerald-500/5 shadow-none dark:border-emerald-500/25",
        className,
      )}
    >
      <CardHeader className="gap-2 px-4 py-3">
        <div className="flex gap-2.5">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden
          />
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-sm font-medium text-emerald-950 dark:text-emerald-50">
              Cloudflare verified accounts
            </CardTitle>
            <p className="text-xs leading-snug text-emerald-950/85 dark:text-emerald-100/85">
              <a
                href={CF_VERIFIED_DESTINATIONS_LIMITS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 font-medium underline-offset-2 hover:underline"
              >
                Verified destination addresses
                <ExternalLink className="size-3 opacity-70" aria-hidden />
              </a>{" "}
              do not count toward your daily or monthly send quota (up to 200 verified destinations
              per account). Add a subscriber, open Cloudflare&apos;s verification email, and click
              the link.
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
