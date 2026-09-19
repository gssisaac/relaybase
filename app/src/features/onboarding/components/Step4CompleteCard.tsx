"use client";

import { Check, CheckCircle2, Inbox, LayoutDashboard, Mail, Settings, Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function Step4CompleteCard({
  activeDomain,
  createdAddress,
  createdAddresses,
}: {
  activeDomain?: string;
  createdAddress?: string;
  createdAddresses?: string[];
}) {
  const mailboxes =
    createdAddresses && createdAddresses.length > 0
      ? createdAddresses
      : createdAddress
        ? [createdAddress]
        : [];
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Celebration Header */}
      <div className="flex flex-col items-center justify-center gap-3 py-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold tracking-tight sm:text-xl">
            You&apos;re All Set!
          </h2>
          <p className="max-w-sm text-xs text-muted-foreground sm:text-sm">
            Cloudflare Email API, domain routing, and your primary account are fully configured.
          </p>
        </div>
      </div>

      {/* Summary Checklist */}
      <div className="space-y-2.5 rounded-lg border bg-card/60 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Configuration Summary
        </h3>
        <ul className="space-y-2 text-xs sm:text-sm">
          <li className="flex items-center gap-2.5">
            <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <Check className="size-3.5 stroke-[2.5]" />
            </div>
            <span className="font-medium text-foreground">Cloudflare Email Worker & API:</span>
            <span className="text-muted-foreground">Active</span>
          </li>
          {activeDomain && (
            <li className="flex items-center gap-2.5">
              <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5 stroke-[2.5]" />
              </div>
              <span className="font-medium text-foreground">Connected Domain:</span>
              <span className="font-mono text-muted-foreground">{activeDomain}</span>
            </li>
          )}
          {mailboxes.length > 0 && (
            <li className="flex items-start gap-2.5">
              <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5 stroke-[2.5]" />
              </div>
              <div className="min-w-0 space-y-1">
                <span className="font-medium text-foreground">
                  {mailboxes.length === 1 ? "Mailbox:" : "Mailboxes:"}
                </span>
                <ul className="space-y-0.5 font-mono text-xs text-muted-foreground sm:text-sm">
                  {mailboxes.map((email) => (
                    <li key={email}>{email}</li>
                  ))}
                </ul>
              </div>
            </li>
          )}
        </ul>
      </div>

      {/* Launch Actions */}
      <div className="space-y-3 pt-2">
        <Button
          type="button"
          size="lg"
          onClick={() => router.replace("/email/inbox")}
          className="w-full gap-2 font-semibold shadow-sm"
        >
          <Inbox className="size-4" />
          Launch Mailbox (Inbox)
          <ArrowRight className="size-4 ml-auto" />
        </Button>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.replace("/studio/dashboard")}
            className="w-full gap-2 text-xs sm:text-sm"
          >
            <LayoutDashboard className="size-4 text-muted-foreground" />
            Open Studio (Campaigns)
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => router.replace("/domains")}
            className="w-full gap-2 text-xs sm:text-sm"
          >
            <Settings className="size-4 text-muted-foreground" />
            Manage Domains & Console
          </Button>
        </div>
      </div>
    </div>
  );
}
