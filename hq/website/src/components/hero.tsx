import Link from "next/link";
import {
  ArrowRight,
  Code2,
  Layers,
  Mail,
  MonitorSmartphone,
} from "lucide-react";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { GithubIcon } from "@/components/icons/github";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const highlights = [
  {
    icon: Mail,
    title: "Unlimited accounts",
    desc: "billing, support, privacy & more",
  },
  {
    icon: Layers,
    title: "Unlimited domains",
    desc: "every zone on your CF account",
  },
  {
    icon: MonitorSmartphone,
    title: "Mac app",
    desc: "Fast, keyboard-first inbox",
  },
  {
    icon: Code2,
    title: "Open Source Worker",
    desc: "100% in your CF account",
  },
] as const;

export function Hero() {
  return (
    <section className="relative overflow-x-clip border-b border-border">
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-40" />
      <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-brand/8 blur-3xl" />
      <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-accent-teal/10 blur-3xl" />

      <div className="relative mx-auto max-w-6xl px-6 py-16 md:py-20 lg:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-12 xl:gap-14">
          <div className="max-w-xl lg:max-w-none">
            <div className="mb-6 flex flex-wrap items-center gap-2">
              <Badge variant="teal" className="px-3 py-1">
                Beta
              </Badge>
              <a
                href={siteConfig.githubWorkerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
              >
                <GithubIcon className="size-3.5" />
                <span>Open Source Worker</span>
              </a>
            </div>

            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem] lg:leading-[1.06]">
              Fast email client
              <span className="mt-2 block text-brand">
                for your Cloudflare domains
              </span>
            </h1>

            <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
              {siteConfig.description}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button render={<Link href={siteConfig.getStartedPath} />} size="lg">
                <DownloadCtaLabel />
                <ArrowRight data-icon="inline-end" />
              </Button>
              <Button
                variant="outline"
                size="lg"
                render={
                  <a
                    href={siteConfig.githubWorkerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                }
                className="gap-2"
              >
                <GithubIcon className="size-4" />
                <span>GitHub</span>
              </Button>
            </div>
          </div>

          <div className="min-w-0 lg:-mr-[130px]">
            <div className="overflow-hidden rounded-2xl border border-border lg:ml-auto lg:w-[780px]">
              <video
                className="aspect-[3350/2160] h-auto w-full object-cover object-top"
                width={780}
                height={503}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                aria-label="Relaybase Mac inbox"
              >
                <source src="/video/relaybase-hero.mp4" type="video/mp4" />
              </video>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {highlights.map((item) => (
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
