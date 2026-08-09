import type { Metadata } from "next";
import {
  Check,
  Cloud,
  KeyRound,
  MonitorSmartphone,
  Shield,
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
import {
  getCurrentProPrice,
  isEarlyAccessActive,
  pageSocialMeta,
  siteConfig,
} from "@/lib/site-config";

const currentProPrice = getCurrentProPrice();
const earlyAccessLive = isEarlyAccessActive();
const priceLabel = earlyAccessLive
  ? `Early Access: $${currentProPrice} once for Pro (normally $${siteConfig.pricing.pro.price})`
  : `$${currentProPrice} once for Pro`;

export const metadata: Metadata = {
  title: `Get ${siteConfig.name}`,
  description: `Free for one domain. ${priceLabel} — an inbox for your own Cloudflare account.`,
  alternates: {
    canonical: siteConfig.getStartedPath,
  },
  ...pageSocialMeta({
    title: `Get ${siteConfig.name}`,
    description: `Start free, or get ${earlyAccessLive ? "Early Access to Pro" : "Pro"} for $${currentProPrice} once${earlyAccessLive ? ` — normally $${siteConfig.pricing.pro.price}` : ""}. Deploy the Worker into your Cloudflare account, connect the Mac app, manage every domain.`,
    path: siteConfig.getStartedPath,
  }),
};

const promises = [
  {
    icon: KeyRound,
    title: "Your Cloudflare account",
    desc: "You deploy the Worker with Wrangler. Domains stay on your zones — we never ask for nameserver hand-off.",
  },
  {
    icon: MonitorSmartphone,
    title: "Mac app + Worker",
    desc: "A fast native inbox over a routing Worker you install — send API and inbound in your account.",
  },
  {
    icon: Cloud,
    title: "Unlimited domains on your plan",
    desc: "Pull every zone from your Cloudflare account. Cloudflare bills Email Sending; we bill once for the app.",
  },
] as const;

export default function GetStartedPage() {
  const { free, pro, earlyAccess } = siteConfig.pricing;
  const showEarlyAccess = earlyAccessLive;
  const proPrice = currentProPrice;

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
                Free for one domain ·{" "}
                {showEarlyAccess ? "Early Access" : ""} ${proPrice} for Pro
              </Badge>

              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl">
                Get{" "}
                <span className="text-brand">{siteConfig.name}</span>
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Leave your email on the waitlist for launch access. When the Mac
                app ships, you&apos;ll get a license for your own Cloudflare
                account — not a hosted mailbox we operate.
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
                    We sell software. Cloudflare Email Sending (~$
                    {siteConfig.cloudflareEmailSendingMonthly}/mo) is billed by
                    Cloudflare on your account. Email Sending is currently in
                    Cloudflare&apos;s public beta — we track every change and
                    ship Worker updates the same day.
                  </p>
                </div>
              </div>

              <Card className="border-2 border-brand/20 bg-white shadow-md">
                <CardHeader className="pb-2 text-center">
                  <Badge variant="teal" className="mx-auto w-fit">
                    {showEarlyAccess
                      ? `Early Access — first ${earlyAccess.seatsTotal} only`
                      : "Launch notify"}
                  </Badge>
                  <CardTitle className="mt-3 text-2xl">
                    Free, or ${proPrice} once for Pro
                  </CardTitle>
                  <CardDescription>
                    Join the list — we&apos;ll email you when checkout opens
                  </CardDescription>

                  <div className="mt-5 flex items-baseline justify-center gap-3">
                    <span className="text-5xl font-bold tracking-tight text-brand">
                      ${proPrice}
                    </span>
                    <span className="text-muted-foreground">once for Pro</span>
                    {showEarlyAccess ? (
                      <span className="text-lg text-muted-foreground line-through">
                        ${pro.price}
                      </span>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  <ul className="space-y-2.5 text-left text-sm">
                    {[
                      `Free forever — ${free.domains} domain, ${free.addresses} address`,
                      "Pro: unlimited domains, Mac app (Windows later)",
                      "Worker install into your Cloudflare account",
                      "Send + inbound API from your Worker",
                      ...(showEarlyAccess ? ["Early Access price locked for life"] : []),
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
