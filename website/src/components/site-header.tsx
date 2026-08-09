import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

const navItems = [
  { href: "/#addresses", label: "Addresses" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#integrate", label: "Integrate" },
  { href: "/#features", label: "Features" },
  { href: "/#infrastructure", label: "Infrastructure" },
  { href: "/resources", label: "Resources" },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Mail className="size-4" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {siteConfig.name}
          </span>
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
          <Badge variant="teal" className="hidden sm:inline-flex">
            Free, or ${siteConfig.pricing.pro.price} once for Pro
          </Badge>
          <Button render={<Link href={siteConfig.getStartedPath} />} size="sm">
            Get started
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </div>
    </header>
  );
}
