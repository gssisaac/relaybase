import type { Metadata } from "next";
import {
  Cloud,
  KeyRound,
  MonitorSmartphone,
  Shield,
} from "lucide-react";

import { BetaForm } from "@/components/beta-form";
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
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Join the ${siteConfig.name} beta`,
  description:
    "Join the Relaybase beta. We will email you a download link for the Mac app — a Worker you install on your own Cloudflare account.",
  alternates: {
    canonical: siteConfig.getStartedPath,
  },
  ...pageSocialMeta({
    title: `Join the ${siteConfig.name} beta`,
    description:
      "Leave your email and we will send a personal download link for the Mac app. You deploy the Worker into your Cloudflare account.",
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
    title: "Every domain on your account",
    desc: "Pull every zone from your Cloudflare account. Cloudflare bills Email Sending on your side.",
  },
] as const;

export default function GetStartedPage() {
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
                variant="teal"
                className="mb-6 px-3 py-1"
              >
                Beta
              </Badge>

              <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl">
                Join the{" "}
                <span className="text-brand">{siteConfig.name}</span> beta
              </h1>

              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Leave your email and we will send a personal download link for
                the Mac app. You get a license for your own Cloudflare account
                — not a hosted mailbox we operate.
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
                    Mac app download
                  </Badge>
                  <CardTitle className="mt-3 text-2xl">
                    Join the beta
                  </CardTitle>
                  <CardDescription>
                    We will email you a personal download link
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  <BetaForm />
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
