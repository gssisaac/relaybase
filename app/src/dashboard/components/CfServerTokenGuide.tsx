"use client";

import { ExternalLink } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CF_API_TOKENS_URL,
  CF_REQUIRED_TOKEN_PERMISSIONS,
  desktopOpenExternal,
} from "@/lib/desktop/bridge";

/**
 * Permissions guide for the optional server token (Email Sending Edit).
 * Modeled on CfInstallTokenGuide. The server token is pushed to the Worker as
 * the CF_API_TOKEN wrangler secret so the Worker can send mail. It is optional
 * during install — if skipped, the user sets it later in Settings. The
 * install token (Workers Scripts / KV / R2 Edit) is obtained via Cloudflare
 * OAuth (Connect with Cloudflare in Settings), not pasted here.
 */
export function CfServerTokenGuide() {
  return (
    <Accordion>
      <AccordionItem value="cf-server-token-permissions" className="border-0">
        <AccordionTrigger className="justify-start gap-1 py-0 text-xs font-normal text-muted-foreground hover:text-foreground hover:underline **:data-[slot=accordion-trigger-icon]:ml-1 **:data-[slot=accordion-trigger-icon]:size-3">
          What is the server token for?
        </AccordionTrigger>
        <AccordionContent className="mt-2 space-y-3 rounded-lg border border-border/60 bg-muted/20 px-3 pt-3 pb-3 text-xs text-muted-foreground [&_p:not(:last-child)]:mb-0">
          <p>
            The <span className="text-foreground">server token</span> is a
            separate Cloudflare API token with{" "}
            <span className="font-mono text-foreground">
              Account → Email Sending → Edit
            </span>
            . It is pushed to your Worker as the{" "}
            <span className="font-mono text-foreground">CF_API_TOKEN</span>{" "}
            wrangler secret so the Worker can send mail. It is never used for
            deploy.
          </p>
          <p>
            You can skip it now and add it later in{" "}
            <span className="text-foreground">Settings → Cloudflare</span>. If
            you skip it, sending will be disabled until you push one.
          </p>

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
              Choose{" "}
              <span className="text-foreground">Create Custom Token</span>.
            </li>
            <li>
              Name it something like{" "}
              <span className="font-mono text-foreground">relaybase-server</span>
              .
            </li>
            <li>Under Permissions, add (Account scope, Edit access):</li>
          </ol>

          <ul className="list-disc space-y-1 pl-4">
            {CF_REQUIRED_TOKEN_PERMISSIONS.map((p) => (
              <li key={p} className="font-mono text-[11px] text-foreground">
                {p}
              </li>
            ))}
          </ul>

          <p>
            The install token (Workers Scripts / KV / R2 Edit) is obtained via
            Cloudflare OAuth — use{" "}
            <span className="text-foreground">Connect with Cloudflare</span> in
            Settings. It cannot send mail, which is why a separate server
            token is still required for sending.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
