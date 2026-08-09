import Link from "next/link";
import { Check, Minus, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getGoogleWorkspaceMonthlyCost,
  siteConfig,
} from "@/lib/site-config";

export function PricingComparison() {
  const workspaceMonthly = getGoogleWorkspaceMonthlyCost();
  const { free, pro } = siteConfig.pricing;
  const cfEmailMonthly = siteConfig.cloudflareEmailSendingMonthly;

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
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
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

          <Card className="relative border-2 border-brand bg-white shadow-md">
            <div className="absolute -top-3 left-6">
              <Badge className="bg-brand text-white shadow-sm">
                Recommended
              </Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{pro.label}</CardTitle>
              <CardDescription>
                Mac app + routing Worker, unlimited domains
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-brand">
                  ${pro.price}
                </span>
                <span className="text-muted-foreground">once</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Includes 1 year of updates. Plus Cloudflare Email Sending (~$
                {cfEmailMonthly}/mo on your account — billed by Cloudflare,
                not us).
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Unlimited domains and addresses on your Cloudflare account",
                "billing@, support@, privacy@, noreply@, hello@, admin@",
                "Audience, Broadcasts, and Metrics",
                "Spark-like inbox, compose, and accounts UI",
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
                Get Pro — ${pro.price}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                After year 1: optional ${pro.renewalPrice}/{pro.renewalPeriodLabel}{" "}
                to keep getting updates. Skip it and your mail keeps working.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl">Google Workspace</CardTitle>
              <CardDescription>
                {siteConfig.googleWorkspace.plan} — one paid seat per address
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-muted-foreground">
                  ${workspaceMonthly}
                </span>
                <span className="text-muted-foreground">/mo for 6 seats</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                ${siteConfig.googleWorkspace.perUserMonthly}/user ×{" "}
                {siteConfig.googleWorkspace.usersForSixAddresses} addresses
                (annual billing)
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Full inbox UI per user (often overkill)",
                "No transactional send API out of the box",
                "Requires SMTP relay or third-party tooling",
                "Inbound routing needs extra setup",
                "Cost scales linearly with every new address",
                "Designed for humans, not product automation",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <Minus className="mt-0.5 size-4 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

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
          </div>
        </div>
      </div>
    </section>
  );
}
