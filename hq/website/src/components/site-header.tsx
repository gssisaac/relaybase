import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const navItems = [
  { href: "/#integrate", label: "Integrate" },
  { href: "/#features", label: "Features" },
  { href: "/#infrastructure", label: "Infrastructure" },
  { href: "/resources", label: "Resources" },
  { href: "/release-notes", label: "Release notes" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/icon.png"
            alt=""
            width={32}
            height={32}
            className="size-8"
            priority
          />
          <span className="text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </span>
          <Badge variant="teal" className="hidden sm:inline-flex">
            Beta
          </Badge>
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button render={<Link href={siteConfig.getStartedPath} />} size="sm">
            <DownloadCtaLabel />
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </header>
  );
}
