"use client";

import type { ReactNode } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Cloudflare Email Service — daily limits & limit-increase form (docs-linked). */
export const CF_EMAIL_SENDING_LIMITS_URL =
  "https://developers.cloudflare.com/email-service/platform/limits/";
export const CF_EMAIL_SENDING_PRICING_URL =
  "https://developers.cloudflare.com/email-service/platform/pricing/";
export const CF_EMAIL_LIMIT_INCREASE_FORM_URL =
  "https://forms.gle/eX6pXvit1wBv77Yw5";

const linkClass =
  "inline-flex items-center gap-0.5 text-primary underline-offset-2 hover:underline";

function DocLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
      {children}
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

export function CampaignCloudflareSendingLimitsCard({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "border-amber-600/35 bg-amber-500/10 shadow-none dark:border-amber-500/30 dark:bg-amber-500/5",
        className,
      )}
    >
      <CardHeader className="gap-2 px-4 py-3">
        <div className="flex gap-2.5">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
            aria-hidden
          />
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="text-sm font-medium text-amber-950 dark:text-amber-50">
              Cloudflare daily send quota
            </CardTitle>
            <p className="text-xs leading-snug text-amber-950/85 dark:text-amber-100/85">
              Broadcasts send through your Worker and Cloudflare Email Sending. New accounts start on a
              conservative daily cap; Cloudflare does not publish a fixed starting number. Limits rise
              over time as your sending pattern and deliverability improve.
            </p>
            <p className="text-xs leading-snug text-amber-950/85 dark:text-amber-100/85">
              Hitting the cap can stop a campaign mid-run (
              <span className="font-medium">account daily sending quota exceeded</span>). Workers Paid
              billing is separate from this quota. Mail to verified destination addresses may not count
              toward monthly or daily quotas on established accounts, but new or not-yet-warmed setups
              can still hit anti-abuse limits first.
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-amber-950/75 dark:text-amber-100/75">
              <DocLink href={CF_EMAIL_SENDING_LIMITS_URL}>Cloudflare limits</DocLink>
              <DocLink href={CF_EMAIL_LIMIT_INCREASE_FORM_URL}>Request higher limits</DocLink>
              <DocLink href={CF_EMAIL_SENDING_PRICING_URL}>Pricing</DocLink>
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
