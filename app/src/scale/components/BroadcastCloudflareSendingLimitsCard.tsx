"use client";

import type { ReactNode } from "react";
import { ExternalLink, TriangleAlert } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Shown in UI — Cloudflare daily cap varies by account; plan broadcasts around this ceiling. */
export const CF_EMAIL_DAILY_SEND_LIMIT = 100;

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

export function BroadcastCloudflareSendingLimitsCard({ className }: { className?: string }) {
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
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <CardTitle className="text-sm font-medium text-amber-950 dark:text-amber-50">
                Daily send limit (Cloudflare)
              </CardTitle>
              <span className="text-lg font-semibold tabular-nums text-amber-950 dark:text-amber-50">
                {CF_EMAIL_DAILY_SEND_LIMIT}
                <span className="text-xs font-normal text-amber-950/75 dark:text-amber-100/75">
                  {" "}
                  emails / day
                </span>
              </span>
            </div>
            <p className="text-xs leading-snug text-amber-950/85 dark:text-amber-100/85">
              Broadcasts use your Worker and Cloudflare Email Sending. Going over{" "}
              {CF_EMAIL_DAILY_SEND_LIMIT}/day can fail remaining recipients mid-send (
              <span className="font-medium">account daily sending quota exceeded</span>). Workers Paid
              is separate from this daily cap.
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
