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
    title: "Workers Scripts Write",
    body: "Puts the Relaybase Worker in your Cloudflare account, connects it to your mailbox storage and databases, and sets the secret the app uses to talk to that Worker. Also turns on the Worker URL so you can reach it.",
  },
  {
    title: "Workers R2 Storage Write",
    body: "Creates the mailbox bucket in your account — where incoming mail, sent mail, and send history live. Checks that object storage is enabled first. If a bucket already exists, we look for data before replacing anything, and only empty it if you confirm a reinstall.",
  },
  {
    title: "D1 Write",
    body: "Creates three databases in your account: one for product data (domains, addresses, settings, audiences, broadcasts), one for the activity log you see in the dashboard, and one so you can search incoming mail quickly. Install creates the empty databases; the Worker fills them in after it is running.",
  },
  {
    title: "Secrets Store Write",
    body: "Shown on Cloudflare’s consent screen because it is part of the permission list we request. Install does not use it. Worker secrets such as the admin token are set with Workers Scripts Write.",
    note: "not used",
  },
];

const NOT_NEEDED = [
  "Sending mail",
  "Reading your inbox, search, Sent, or drafts",
  "Changing a domain’s MX records or inbox routing rules",
  "Writing DMARC or other DNS records",
];

export function CfOauthInstallDetailsSheet({
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
          <SheetTitle>Why we ask for these permissions</SheetTitle>
          <SheetDescription>
            Install Relaybase in your Cloudflare account — not send or read
            mail.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="space-y-8 px-5 py-6">
            <header className="space-y-3">
              <p className="text-[15px] leading-relaxed text-foreground">
                These permissions let Relaybase install into{" "}
                <span className="font-medium">your</span> Cloudflare account.
                After setup, the Worker, mailbox storage, and databases live
                there — not on Relaybase servers.
              </p>
              <div className="rounded-lg border border-border/70 bg-muted/40 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Sending is separate
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                  Authorization does not send mail, read your inbox, or change
                  domain DNS. Sending is done by the installed Worker. Inbox
                  routing on a domain is a later step, with a different token.
                </p>
              </div>
            </header>

            <section className="space-y-4">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                What each permission is for
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
                What these permissions do not do
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
                In short, this is permission to put Relaybase in your Cloudflare
                account — a Worker, mailbox storage, and databases.{" "}
                <span className="text-foreground">
                  It is not permission to send mail or change your domain.
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
                      Relaybase never stores this authorization
                    </CardTitle>
                  </div>
                  <CardDescription className="leading-relaxed">
                    The permission lives only in this app while it is open.
                    Relaybase does not receive a copy. Closing the app clears
                    it.
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
