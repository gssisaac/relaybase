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
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Get ${siteConfig.name}`,
  description: `Buy the ${siteConfig.name} Mac app for $${siteConfig.pricing.oneTime} — product email on your own Cloudflare account.`,
  alternates: {
    canonical: siteConfig.getStartedPath,
  },
  ...pageSocialMeta({
    title: `Get ${siteConfig.name}`,
    description: `$${siteConfig.pricing.oneTime} one-time. Deploy the Worker into your Cloudflare account, connect the Mac app, manage every domain.`,
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
    desc: "Spark-like inbox UX over a routing Worker you install — send API and inbound in your account.",
  },
  {
    icon: Cloud,
    title: "Unlimited domains on your plan",
    desc: "Pull every zone from your Cloudflare account. Cloudflare bills Email Sending; we bill once for the app.",
  },
] as const;

export default function GetStartedPage() {
  const { pricing } = siteConfig;

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
                One-time license — ${pricing.oneTime}
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
                    Cloudflare on your account.
                  </p>
                </div>
              </div>

              <Card className="border-2 border-brand/20 bg-white shadow-md">
                <CardHeader className="pb-2 text-center">
                  <Badge variant="teal" className="mx-auto w-fit">
                    Launch notify
                  </Badge>
                  <CardTitle className="mt-3 text-2xl">
                    ${pricing.oneTime} one-time
                  </CardTitle>
                  <CardDescription>
                    Join the list — we&apos;ll email you when checkout opens
                  </CardDescription>

                  <div className="mt-5 flex items-baseline justify-center gap-3">
                    <span className="text-5xl font-bold tracking-tight text-brand">
                      ${pricing.oneTime}
                    </span>
                    <span className="text-muted-foreground">once</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-2">
                  <ul className="space-y-2.5 text-left text-sm">
                    {[
                      "Mac app license (Windows later)",
                      "Worker install into your Cloudflare account",
                      "Unlimited domains on your CF plan",
                      "Send + inbound API from your Worker",
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
