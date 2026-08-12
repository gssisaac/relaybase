"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CF_API_TOKENS_URL,
  CF_INSTALL_TOKEN_PERMISSIONS,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";

export function CfInstallTokenGuide() {
  return (
    <Accordion>
      <AccordionItem value="cf-token-permissions" className="border-0">
        <AccordionTrigger className="justify-start gap-1 py-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline **:data-[slot=accordion-trigger-icon]:ml-1 **:data-[slot=accordion-trigger-icon]:size-3">
          How to set token permissions
        </AccordionTrigger>
        <AccordionContent className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 px-3 pt-3 pb-3 text-xs text-muted-foreground [&_p:not(:last-child)]:mb-0">
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>
              Open{" "}
              <button
                type="button"
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
                onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
              >
                Cloudflare API Tokens
                <ExternalLink className="size-3" />
              </button>
              .
            </li>
            <li>
              Choose <span className="text-foreground">Create Custom Token</span>
              .
            </li>
            <li>
              Name it something like{" "}
              <span className="font-mono text-foreground">relaybase-install</span>
              .
            </li>
            <li>
              Under Permissions, add exactly these three rows (Account scope,
              Edit access):
            </li>
          </ol>

          <ul className="list-disc space-y-1 pl-4">
            {CF_INSTALL_TOKEN_PERMISSIONS.map((p) => (
              <li key={p} className="font-mono text-[11px] text-foreground">
                {p}
              </li>
            ))}
          </ul>

          <p>
            You do not need Email Sending, DNS, or Zone permissions for this
            install step — those are optional later in Settings.
          </p>

          <div className="overflow-hidden rounded-md border border-border bg-background">
            <Image
              src="/setup/cf-install-token-permissions.webp"
              alt="Cloudflare custom token permissions: Account Workers Scripts Edit, Workers KV Storage Edit, and Workers R2 Storage Edit"
              width={1112}
              height={447}
              className="h-auto w-full"
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={() => void desktopOpenExternal(CF_API_TOKENS_URL)}
          >
            Open Cloudflare API Tokens
            <ExternalLink className="size-3" />
          </button>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
