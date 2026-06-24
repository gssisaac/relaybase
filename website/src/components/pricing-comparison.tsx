import { Check, Minus, TrendingDown } from "lucide-react";

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
  getAnnualSavings,
  getGoogleWorkspaceMonthlyCost,
  getMonthlySavings,
  siteConfig,
} from "@/lib/site-config";

export function PricingComparison() {
  const workspaceMonthly = getGoogleWorkspaceMonthlyCost();
  const relaybaseMonthly = siteConfig.pricing.monthly;
  const monthlySavings = getMonthlySavings();
  const annualSavings = getAnnualSavings();
  const savingsPercent = Math.round(
    (monthlySavings / workspaceMonthly) * 100,
  );

  return (
    <section id="pricing" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge variant="outline" className="mb-4">
            Pricing
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            The cheapest way to run product email
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One flat price per domain. No per-seat math, no surprise overages.
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
                Unlimited standard addresses on one domain
              </CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-5xl font-bold tracking-tight text-brand">
                  ${relaybaseMonthly}
                </span>
                <span className="text-muted-foreground">/month per domain</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "billing@, support@, privacy@, noreply@, hello@, admin@",
                "Transactional send API",
                "Inbound receive + webhooks",
                "Multi-product: one API key per domain",
                "Send logs & delivery monitoring",
                "No per-mailbox or per-seat fees",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent-teal" />
                  <span>{item}</span>
                </div>
              ))}
              <Button className="mt-6 w-full" size="lg">
                Get started — ${relaybaseMonthly}/mo
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="text-2xl">
                Google Workspace
              </CardTitle>
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
                <div key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
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
              <TrendingDown className="size-6 text-accent-teal" />
            </div>
            <h3 className="text-2xl font-bold text-accent-foreground">
              Save ${monthlySavings}/month — {savingsPercent}% less
            </h3>
            <p className="text-accent-foreground/80">
              When you need six standard product addresses, Google Workspace
              costs{" "}
              <span className="font-semibold">${workspaceMonthly}/mo</span>.
              Relaybase covers all six for{" "}
              <span className="font-semibold">${relaybaseMonthly}/mo</span>.
              That&apos;s{" "}
              <span className="font-semibold">${annualSavings}/year</span> back
              in your budget — per domain.
            </p>
            <p className="text-sm text-accent-foreground/70">
              Running three products? Multiply the savings. Three domains on
              Relaybase: ${relaybaseMonthly * 3}/mo vs ${workspaceMonthly * 3}/mo
              on Workspace.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
