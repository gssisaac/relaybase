import Link from "next/link";
import { Check, Shield, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isEarlyAccessActive, siteConfig } from "@/lib/site-config";

export function PricingComparison() {
  const { free, pro, earlyAccess } = siteConfig.pricing;
  const cfEmailMonthly = siteConfig.cloudflareEmailSendingMonthly;
  const showEarlyAccess = isEarlyAccessActive();
  const proPrice = showEarlyAccess ? earlyAccess.price : pro.price;

  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Start free. Pay once for everything else.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Relaybase is software — not a hosted email intermediary. You pay
            Cloudflare for Email Sending; we never bill monthly for domains.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {siteConfig.pricingNote}
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          <Card className="bg-white">
            <CardHeader>
              <CardTitle className="text-2xl">{free.label}</CardTitle>
              <CardDescription>Try it on one domain, for good</CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-foreground">
                  ${free.price}
                </span>
                <span className="text-muted-foreground">forever</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                No credit card. Not a trial — it never expires.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                `${free.domains} Cloudflare domain`,
                `${free.addresses} email address`,
                "Send API + inbound webhooks from your Worker",
                "Worker installed in your account — we don't host mail",
                "Community docs support",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-teal" />
                  <span>{item}</span>
                </div>
              ))}
              <Button
                render={<Link href={siteConfig.getStartedPath} />}
                variant="outline"
                className="mt-6 w-full"
                size="lg"
              >
                Start free
              </Button>
            </CardContent>
          </Card>

          <Card className="relative overflow-visible border-2 border-brand bg-white shadow-md">
            <div className="absolute -top-3 left-6">
              <Badge className="bg-brand text-white shadow-sm">
                {showEarlyAccess ? (
                  <>
                    <Sparkles className="mr-1 size-3" />
                    Early Access — first {earlyAccess.seatsTotal} only
                  </>
                ) : (
                  "Recommended"
                )}
              </Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{pro.label}</CardTitle>
              <CardDescription>
                Mac app + routing Worker, unlimited domains
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold tracking-tight text-brand">
                  ${proPrice}
                </span>
                <span className="text-muted-foreground">once</span>
                {showEarlyAccess ? (
                  <span className="text-lg text-muted-foreground line-through">
                    ${pro.price}
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {showEarlyAccess ? "Early Access price, locked for life. " : ""}
                Includes 1 year of updates plus Cloudflare Email Sending (~$
                {cfEmailMonthly}/mo on your account — billed by Cloudflare, not
                us).
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Unlimited domains and addresses on your Cloudflare account",
                "billing@, support@, privacy@, noreply@, hello@, admin@",
                "Audience, Broadcasts, and Metrics",
                "Fast, keyboard-first inbox, compose, and accounts UI",
                "3 team seats for shared inboxes",
                "Priority support",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-teal" />
                  <span>{item}</span>
                </div>
              ))}
              <Button
                render={<Link href={siteConfig.getStartedPath} />}
                className="mt-6 w-full"
                size="lg"
              >
                {showEarlyAccess ? "Get Early Access" : "Get Pro"} — ${proPrice}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                After year 1: optional ${pro.renewalPrice}/{pro.renewalPeriodLabel}{" "}
                to keep getting updates. Skip it and your mail keeps working.
              </p>
            </CardContent>
          </Card>
        </div>

        {showEarlyAccess ? (
          <p className="mx-auto mt-6 max-w-lg text-center text-sm text-muted-foreground">
            Early Access closes when the first {earlyAccess.seatsTotal} seats
            are claimed or Relaybase officially launches, whichever comes
            first. Your price never goes up after that — regular Pro is $
            {pro.price}.
          </p>
        ) : null}

        <div className="mt-10 rounded-2xl border border-accent-teal/30 bg-accent p-8 text-center md:p-10">
          <div className="mx-auto flex max-w-lg flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm">
              <Shield className="size-6 text-accent-teal" />
            </div>
            <h3 className="text-2xl font-bold text-accent-foreground">
              Your mail never stops — even if you never pay us again
            </h3>
            <p className="text-accent-foreground/80">
              Relaybase installs a Worker into <em>your</em> Cloudflare
              account. It sends and receives mail on its own — not through
              us. Skip a year of Pro updates and your inbox keeps working;
              we sell software and (optionally) updates, not a subscription
              to your own mail.
            </p>
            <p className="text-sm text-accent-foreground/70">
              Built on Cloudflare&apos;s Email Sending API, currently in
              public beta — we track every change and ship Worker updates the
              same day.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
