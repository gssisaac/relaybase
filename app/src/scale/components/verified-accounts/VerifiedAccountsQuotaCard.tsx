"use client";

import { ShieldCheck } from "lucide-react";

import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
              Subscribers verified as Email Routing destination addresses receive mail
              without counting toward your Cloudflare daily send quota. Add an account,
              open the verification email, then click the link to activate free sending.
            </p>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
}
