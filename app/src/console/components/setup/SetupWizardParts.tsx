"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";

export const RESOURCE_NAMES = [
  {
    name: "relaybase-api",
    kind: "Worker",
    why: "Your routing + admin API process. Deployed into your Cloudflare account; the Mac app only talks to this URL.",
    detail:
      "This is the small program Relaybase runs inside your Cloudflare account. It's the brain that handles sending and receiving email, manages your addresses, and talks to the Mac app. The Mac app only ever contacts this one address (your Worker URL) using your admin token — Relaybase's own servers never see your mail.",
  },
  {
    name: "relaybase-mailbox",
    kind: "R2",
    why: "Stores inbound and sent mail. Created automatically during install.",
    detail:
      "This is where incoming and sent email is stored in your Cloudflare account. Incoming mail lands under inbound/, sent mail under sent/. Only you and your Worker can see what's inside.",
  },
  {
    name: "relaybase-db",
    kind: "D1",
    why: "Product database — domains, addresses, audience, broadcasts, API keys, and settings.",
    detail:
      "This is Relaybase's source of truth inside your Cloudflare account. It holds domains, addresses, audience lists, broadcasts, branding, API keys, auth tokens, and settings. It lives entirely in your account — Relaybase can't read it.",
  },
  {
    name: "relaybase-mail",
    kind: "D1",
    why: "List/count/search index for inbound + sent mail.",
    detail:
      "A searchable index of inbound and sent mail so the inbox can list, count, and find messages by subject, from, to, or body without opening every stored email. Mail bodies stay in R2; this database is a rebuildable index.",
  },
  {
    name: "relaybase-logs",
    kind: "D1",
    why: "Ops-event log (compose/API/broadcast sends + inbound bounces) for the Dashboard Log page.",
    detail:
      "A small database that records what was sent and any bounced emails, so you can review it later on the Dashboard Log page. Your main send history is also kept in R2.",
  },
] as const;

/**
 * Always-visible "What we install" panel on the install setup page.
 * Lists every Cloudflare resource Relaybase creates in the user's account,
 * each with a Cloudflare-style product icon for instant recognition.
 */
export function WhatWeInstall() {
  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">What we install in your account</p>
      <ul className="space-y-3">
        {RESOURCE_NAMES.map((r) => (
          <li key={`${r.kind}-${r.name}`} className="flex items-start gap-3">
            <CloudflareModuleIcon
              kind={r.kind}
              className="mt-0.5 size-5 shrink-0"
            />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 font-mono text-xs">
                <span className="text-muted-foreground">{r.kind}</span>{" "}
                <span className="font-medium text-foreground">{r.name}</span>
                <Popover>
                  <PopoverTrigger
                    render={
                      <button
                        type="button"
                        aria-label={`${r.kind} ${r.name} details`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Info className="size-3" />
                      </button>
                    }
                  />
                  <PopoverContent
                    align="start"
                    side="bottom"
                    className="max-w-xs"
                  >
                    <p className="text-xs text-muted-foreground">{r.detail}</p>
                  </PopoverContent>
                </Popover>
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.why}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Install and receive mail on the free plan. Sending email requires a
        Cloudflare Workers Paid plan (~$5/mo, billed by Cloudflare).
      </p>
    </div>
  );
}
