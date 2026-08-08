"use client";

import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Managed nameserver onboarding (pointing customer domains at Relaybase's
 * Cloudflare account) is frozen — that model conflicts with Cloudflare ToS
 * and creates a single-account SPOF. Domains must already live on the user's
 * own Cloudflare account; setup continues in the desktop app.
 */
export function ConnectDomainDialog({
  domain,
  open,
  onOpenChange,
}: {
  domain: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono">Connect {domain}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Managed nameserver onboarding is no longer available. Relaybase
            does not host your domain under our Cloudflare account.
          </p>
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">What changed</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                Your domains must already be on <strong>your own</strong>{" "}
                Cloudflare account.
              </li>
              <li>
                You deploy the routing Worker into <em>your</em> Cloudflare
                account; the Mac app connects to that Worker and manages
                addresses from there.
              </li>
              <li>We never ask you to point nameservers at Relaybase.</li>
            </ul>
          </div>
          <div className="flex items-center justify-end gap-2 border-t pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              render={
                <a
                  href="https://relaybase.xyz"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              Get the Mac app
              <ExternalLink data-icon="inline-end" className="size-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
