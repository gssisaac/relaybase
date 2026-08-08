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
  const oneTime = siteConfig.pricing.oneTime;
  const cfEmailMonthly = siteConfig.cloudflareEmailSendingMonthly;

  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Buy once. Run on your Cloudflare plan.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Relaybase is software — not a hosted email intermediary. You pay
            Cloudflare for Email Sending; we never bill monthly for domains.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Card className="relative border-2 border-brand bg-white shadow-md">
            <div className="absolute -top-3 left-6">
              <Badge className="bg-brand text-white shadow-sm">
                Recommended
              </Badge>
            </div>
            <CardHeader className="pt-8">
              <CardTitle className="text-2xl">{siteConfig.name}</CardTitle>
              <CardDescription>
                Mac app + routing Worker for your Cloudflare account
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-brand">
                  ${oneTime}
                </span>
                <span className="text-muted-foreground">one-time</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Plus Cloudflare Email Sending (~${cfEmailMonthly}/mo on your
                account — billed by Cloudflare, not us).
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Unlimited domains on your Cloudflare account",
                "billing@, support@, privacy@, noreply@, hello@, admin@",
                "Spark-like inbox, compose, and accounts UI",
                "Send API + inbound webhooks from your Worker",
                "Worker installed in your account — we don't host mail",
                "No per-domain or per-seat Relaybase fees",
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
                Get Relaybase — ${oneTime}
              </Button>
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
                <span className="text-muted-foreground">/month for 6 seats</span>
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
              We never touch your mail
            </h3>
            <p className="text-accent-foreground/80">
              Relaybase installs a Worker into <em>your</em> Cloudflare account.
              Send, receive, and storage stay under your credentials. We sell
              software and a license — not intermediary email hosting.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
