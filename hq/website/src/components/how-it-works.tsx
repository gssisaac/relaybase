import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { ShowDetail } from "@/components/show-detail";
import { cn } from "@/lib/utils";

type HowItWorksStep = {
  id: string;
  title: string;
  lede: string;
  body: string[];
  details?: { kind: string; name: string; role: string }[];
  src: string;
  alt: string;
};

const steps: HowItWorksStep[] = [
  {
    id: "install",
    title: "You install the mailbox into your Cloudflare account",
    lede: "You install a Worker, a mailbox bucket, and three databases into your Cloudflare account. After that, the app talks to your Worker — not to a Relaybase mail server.",
    body: [
      "There is no Relaybase-hosted mailbox. Setup → Install deploys five resources into your account from the Mac. Mail keeps working if our site is down.",
      "Authorize runs Wrangler on your machine after Cloudflare OAuth. Manual means you deploy the Worker ZIP yourself and paste the Worker URL — the Worker then issues your owner passtoken once. Your Cloudflare credential never leaves the Mac. After Verify, inbox, send, search, and /v1 hit your Worker only. console.relaybase.xyz is for account and license — not the mail path. Receive can run on Cloudflare’s free plan; sending is billed by Cloudflare.",
    ],
    details: [
      {
        kind: "Worker",
        name: "relaybase-api",
        role: "Routing and admin API. The Mac talks only to this URL.",
      },
      {
        kind: "R2",
        name: "relaybase-mailbox",
        role: "Inbound and sent originals. Only you and your Worker read them.",
      },
      {
        kind: "D1",
        name: "relaybase-db",
        role: "Domains, addresses, keys, webhooks, audience, settings.",
      },
      {
        kind: "D1",
        name: "relaybase-inbox-index",
        role: "Rebuildable full-text search. Bodies stay in R2.",
      },
      {
        kind: "D1",
        name: "relaybase-logs",
        role: "Send and bounce events for the Dashboard Log page.",
      },
    ],
    src: "/images/how-it-works/install-resources.png",
    alt: "Infographic: the Mac app talks only to a Worker, R2 bucket, and three D1 databases inside your Cloudflare account.",
  },
  {
    id: "r2-originals",
    title: "Originals accumulate in your R2 bucket",
    lede: "Mail stacks in your R2, not in a Relaybase cloud.",
    body: [
      "The mailbox of record is yours. Reinstall the app, open another Mac, or read via API — the same originals are there.",
      "When mail hits support@, your Worker writes one object tree per message in relaybase-mailbox, grouped by domain. The list file is thin so the inbox can scroll unread without opening every body. Opening a message loads meta.json and attachments from R2. ~/.relaybase caches list pages; it is not a second mailbox.",
    ],
    src: "/images/how-it-works/r2-object-tree.png",
    alt: "Infographic of the relaybase-mailbox R2 tree: inbound and sent prefixes, thin list files, Mac cache only.",
  },
  {
    id: "search-index",
    title: "Search is a D1 index; originals stay in R2",
    lede: "Originals stay in your bucket. Search is a fast index over those originals — not a forwarded copy.",
    body: [
      "You need to find a phrase in the body, not just the subject. Opening every stored object on each query does not scale once a domain has thousands of messages.",
      "relaybase-inbox-index is a rebuildable side index of subject, sender, recipients, and body. Search hits that index. Opening a hit always reloads the real message from R2. If the index is down, receive still works — the Mac filters mail it already loaded instead of a false empty result.",
    ],
    src: "/images/how-it-works/search-index.png",
    alt: "Infographic: search hits a D1 side index; opening a result reloads the original from R2.",
  },
  {
    id: "domain-keys",
    title: "API keys are scoped to one domain",
    lede: "A leaked key can impersonate that domain — not every domain on the account.",
    body: [
      "A Cloudflare token in an app .env can send as any domain on the account if it leaks.",
      "Each Relaybase API key is bound to one domain. A from that does not match is rejected. The Worker stores a hash only. The plaintext secret is shown once and kept under ~/.relaybase — not in D1, and not on Relaybase’s servers.",
    ],
    src: "/images/how-it-works/domain-scoped-key.png",
    alt: "Infographic: one API key locked to yourdomain.com; a from on another domain is rejected.",
  },
];

function HowItWorksStill({ step }: { step: HowItWorksStep }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <Image
        src={step.src}
        alt={step.alt}
        width={1536}
        height={1024}
        className="h-auto w-full"
      />
    </div>
  );
}

export function HowItWorks() {
  return (
    <div id="how-it-works">
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <Badge variant="outline" className="mb-4">
              How it works
            </Badge>
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
              The mailbox lives in your Cloudflare account
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Relaybase is the app. After install, send and receive run on your
              Worker — we never host the mail.
            </p>
          </div>
        </div>
      </section>

      {steps.map((step, index) => (
        <section
          key={step.id}
          aria-labelledby={`how-${step.id}`}
          className={cn(
            "border-b border-border py-16 md:py-20",
            index % 2 === 1 ? "bg-well" : "bg-background",
          )}
        >
          <div
            className={cn(
              "mx-auto grid max-w-6xl items-center gap-10 px-6 lg:gap-14",
              index % 2 === 1
                ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
                : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]",
            )}
          >
            <div className={index % 2 === 1 ? "lg:order-2" : undefined}>
              <h3
                id={`how-${step.id}`}
                className="text-2xl font-bold tracking-tight md:text-3xl"
              >
                {step.title}
              </h3>
              <p className="mt-4 text-foreground">{step.lede}</p>
              {step.details ? (
                <>
                  {step.body[0] ? (
                    <p className="mt-3 text-muted-foreground">{step.body[0]}</p>
                  ) : null}
                  <ShowDetail>
                    {step.body.slice(1).map((paragraph) => (
                      <p key={paragraph} className="mt-3 text-muted-foreground">
                        {paragraph}
                      </p>
                    ))}
                    <ul className="mt-6 space-y-3">
                      {step.details.map((row) => (
                        <li key={row.name} className="text-sm">
                          <p className="font-mono text-xs">
                            <span className="text-muted-foreground">
                              {row.kind}
                            </span>{" "}
                            <span className="font-medium text-foreground">
                              {row.name}
                            </span>
                          </p>
                          <p className="mt-0.5 text-muted-foreground">
                            {row.role}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </ShowDetail>
                </>
              ) : (
                step.body.map((paragraph) => (
                  <p key={paragraph} className="mt-3 text-muted-foreground">
                    {paragraph}
                  </p>
                ))
              )}
            </div>
            <div className={index % 2 === 1 ? "lg:order-1" : undefined}>
              <HowItWorksStill step={step} />
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
