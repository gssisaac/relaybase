"use client";

import { Shield } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const NEEDED: { title: string; body: string; note?: string }[] = [
  {
    title: "Add account",
    body: "Creates the inbox routing rule in Cloudflare Email Routing — look up the zone, turn Routing on, and add a To rule. Without a token you will see “Could not configure inbox for …”.",
  },
  {
    title: "Account inbound on/off",
    body: "Flips that same routing rule between Worker delivery and drop.",
  },
  {
    title: "Delete account",
    body: "Removes the routing rule for that address. The account still leaves D1; without a token, the Cloudflare rule can remain (best-effort cleanup).",
  },
  {
    title: "Domain Email Routing / MX conflicts",
    body: "When an account is added and Routing is turned on, another MX is read — and removed if you force it. Zone Read and DNS permissions are used here.",
  },
  {
    title: "Branding (DMARC DNS)",
    body: "Reads, creates, or updates the _dmarc TXT record when Settings applies branding DNS.",
  },
  {
    title: "Internal routing API",
    body: "GET/POST /mail/inbox/routing uses the same ensureInboundRouting and removeInboundWorkerRouting path as adding an account in the console.",
  },
  {
    title: "Send REST fallback (old Workers only)",
    body: "Used only when a deploy has no EMAIL binding, so send goes through the Email Sending REST API. A Worker redeployed from current code does not take this path.",
    note: "legacy",
  },
  {
    title: "Status probes",
    body: "GET /console/connect reports cfApiTokenValid, and health/ops-log can read D1 size. Without a token these just show “missing / unverified.” Features still work.",
    note: "optional",
  },
];

const NOT_NEEDED = [
  "Compose, reply, API send, mobile send, and broadcasts — when the EMAIL binding is present",
  "Reading mail, search, Sent, and drafts",
  "Adding a domain to D1 only (zone import and Routing are separate)",
  "Audience, API keys, and log lookup",
];

export function CfApiTokenDetailsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="h-full w-full max-w-[560px] gap-0 overflow-hidden p-0 sm:max-w-[560px]"
      >
        <SheetHeader className="shrink-0 border-b border-border/60 pr-12">
          <SheetTitle>When the API token is used</SheetTitle>
          <SheetDescription>
            Zone, routing, and DNS management — not the send path.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="space-y-8 px-5 py-6">
            <header className="space-y-3">
              <p className="text-[15px] leading-relaxed text-foreground">
                The API token is only needed to call the{" "}
                <span className="font-medium">Cloudflare REST API</span>. That
                is the path that changes zones, routing, and DNS — not the path
                that sends mail.
              </p>
              <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sending is separate
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  Current Workers send through the{" "}
                  <span className="font-mono text-xs">EMAIL</span> binding. The
                  API token is not on that path. Only send moved to the binding;
                  everything that writes inbox rules, MX, or DMARC on the zone
                  still needs the API token.
                </p>
              </div>
            </header>

            <section className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Where the token is required
              </h3>
              <ol className="space-y-5">
                {NEEDED.map((item, index) => (
                  <li key={item.title} className="flex gap-3">
                    <span
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold tabular-nums text-foreground"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <h4 className="text-sm font-medium text-foreground">
                          {item.title}
                        </h4>
                        {item.note ? (
                          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                            {item.note}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Where the token is not needed
              </h3>
              <ul className="space-y-2.5">
                {NOT_NEEDED.map((line) => (
                  <li key={line} className="flex gap-3 text-sm leading-relaxed">
                    <span
                      className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground/40"
                      aria-hidden
                    />
                    <span className="text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ul>
            </section>

            <footer className="space-y-4 border-t border-border/60 pt-5">
              <p className="text-sm leading-relaxed text-muted-foreground">
                In short, the token is required for every management write to
                the Cloudflare zone — not only adding or deleting accounts.
                Inbox rules, MX, and DMARC all use it.{" "}
                <span className="text-foreground">
                  Sending is the piece that left for the binding.
                </span>
              </p>
              <Card size="sm" className="border-border bg-card">
                <CardHeader className="pb-0">
                  <div className="flex items-center gap-2">
                    <Shield
                      className="size-3.5 shrink-0 text-foreground"
                      aria-hidden
                    />
                    <CardTitle className="text-sm">
                      Relaybase never stores this token
                    </CardTitle>
                  </div>
                  <CardDescription className="leading-relaxed">
                    The API token lives only as a Secret on the Worker in{" "}
                    <span className="text-foreground">your</span> Cloudflare
                    account. Relaybase does not receive a copy and does not
                    keep any of this information.
                  </CardDescription>
                </CardHeader>
              </Card>
            </footer>
          </article>
        </div>
      </SheetContent>
    </Sheet>
  );
}
