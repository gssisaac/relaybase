import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Code2,
  Layers,
  Mail,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-40" />
      <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-brand/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-accent-teal/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="secondary"
            className="mb-6 border border-border bg-white px-3 py-1 text-muted-foreground"
          >
            <Sparkles className="mr-1.5 size-3.5 text-brand" />
            Built for product builders &amp; multi-product teams
          </Badge>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-6xl">
            Every standard product email.
            <span className="mt-2 block text-brand">
              One flat ${siteConfig.pricing.monthly}/month.
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
            {siteConfig.description}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button render={<Link href="#pricing" />} size="lg">
              Start for ${siteConfig.pricing.monthly}/mo
              <ArrowRight data-icon="inline-end" />
            </Button>
            <Button
              render={<Link href="#integrate" />}
              variant="outline"
              size="lg"
            >
              <Code2 data-icon="inline-start" />
              See the code
            </Button>
          </div>
        </div>

        <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Mail,
              title: "6+ addresses",
              desc: "billing, support, privacy & more",
            },
            {
              icon: Layers,
              title: "Multi-product",
              desc: "one domain per product, same API",
            },
            {
              icon: Code2,
              title: "Embed in minutes",
              desc: "send & receive with fetch()",
            },
            {
              icon: Boxes,
              title: "Cloudflare-backed",
              desc: "enterprise-grade delivery",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-white p-4 text-left shadow-sm"
            >
              <item.icon className="mb-2 size-5 text-brand" />
              <p className="text-sm font-semibold text-foreground">
                {item.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
