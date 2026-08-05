import type { Metadata } from "next";
import {
  Check,
  Cloud,
  Globe2,
  Percent,
  Shield,
  Users,
} from "lucide-react";

import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WaitlistForm } from "@/components/waitlist-form";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Join the waitlist",
  description: `Get early access to ${siteConfig.name} — up to ${siteConfig.waitlist.maxDomains} Cloudflare-managed domains, unlimited accounts, and ${siteConfig.waitlist.discountPercent}% off for your first year.`,
  alternates: {
    canonical: siteConfig.getStartedPath,
  },
  openGraph: {
    title: `Join the ${siteConfig.name} waitlist`,
    description: `$${siteConfig.pricing.monthly}/mo → $${siteConfig.waitlist.monthly}/mo for ${siteConfig.waitlist.durationYears} year. Up to ${siteConfig.waitlist.maxDomains} domains, unlimited accounts.`,
    url: `${siteConfig.url}${siteConfig.getStartedPath}`,
  },
};

const promises = [
  {
    icon: Cloud,
    title: "Domains managed on Cloudflare",
    desc: "DNS, Email Routing, and sending stay on Cloudflare — we provision and operate them for you.",
  },
  {
    icon: Globe2,
    title: `Up to ${siteConfig.waitlist.maxDomains} domains`,
    desc: `Ship every product its own brand domain — up to ${siteConfig.waitlist.maxDomains} under one Relaybase account.`,
  },
  {
    icon: Users,
    title: "Unlimited accounts",
    desc: "Invite your whole team. No per-seat math for operators or product owners.",
  },
] as const;

export default function GetStartedPage() {
  const { pricing, waitlist } = siteConfig;

  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative overflow-hidden border-b border-border">
          <div className="pointer-events-none absolute inset-0 grid-dots opacity-40" />
          <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-brand/8 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-accent-teal/10 blur-3xl" />

          <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <Badge
                variant="secondary"
                className="mb-6 border border-border bg-white px-3 py-1 text-muted-foreground"
              >
                <Percent className="mr-1.5 size-3.5 text-brand" />
                Waitlist — {waitlist.discountPercent}% off for{" "}
                {waitlist.durationYears} year
              </Badge>

              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl">
                Get early access to{" "}
                <span className="text-brand">{siteConfig.name}</span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Join the waitlist for product email on your domain. We manage
                Cloudflare for you — up to {waitlist.maxDomains} domains and
                unlimited accounts.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div className="space-y-4">
                {promises.map((item) => (
                  <div
                    key={item.title}
                    className="flex gap-4 rounded-xl border border-border bg-white p-5 shadow-sm"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <item.icon className="size-5" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-foreground">
                        {item.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="flex items-start gap-3 rounded-xl border border-accent-teal/25 bg-accent/60 px-5 py-4 text-left text-sm text-accent-foreground/90">
                  <Shield className="mt-0.5 size-4 shrink-0 text-accent-teal" />
                  <p>
                    Built on Cloudflare Workers, Email Routing, and Email
                    Sending — the same edge network that protects millions of
                    sites.
                  </p>
                </div>
              </div>

              <Card className="border-2 border-brand/20 bg-white shadow-md">
                <CardHeader className="pb-2 text-center">
                  <Badge variant="teal" className="mx-auto w-fit">
                    Waitlist pricing
                  </Badge>
                  <CardTitle className="mt-3 text-2xl">
                    Lock in {waitlist.discountPercent}% off
                  </CardTitle>
                  <CardDescription>
                    Standard price for your first {waitlist.durationYears} year
                    after launch
                  </CardDescription>

                  <div className="mt-5 flex items-baseline justify-center gap-3">
                    <span className="text-2xl font-semibold text-muted-foreground line-through decoration-brand/40">
                      ${pricing.monthly}
                    </span>
                    <span className="text-5xl font-bold tracking-tight text-brand">
                      ${waitlist.monthly}
                    </span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    per domain · {waitlist.discountPercent}% off for{" "}
                    {waitlist.durationYears} year
                  </p>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  <ul className="space-y-2.5 text-left text-sm">
                    {[
                      `Up to ${waitlist.maxDomains} Cloudflare-managed domains`,
                      "Unlimited accounts — no seat fees",
                      "Send + inbound API on your brand domain",
                      `$${waitlist.monthly}/mo waitlist rate for ${waitlist.durationYears} year`,
                    ].map((line) => (
                      <li key={line} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 size-4 shrink-0 text-accent-teal" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  <WaitlistForm />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
