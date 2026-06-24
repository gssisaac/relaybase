import Link from "next/link";
import { Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Mail className="size-4" />
            </div>
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </div>

          <p className="max-w-md text-sm text-muted-foreground">
            Product email for builders. Send and receive from every standard
            address on your domain — ${siteConfig.pricing.monthly}/month, powered
            by Cloudflare.
          </p>

          <Button render={<Link href="#pricing" />} size="lg">
            Start for ${siteConfig.pricing.monthly}/mo
          </Button>

          <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link href="#addresses" className="hover:text-foreground">
              Addresses
            </Link>
            <Link href="#pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="#integrate" className="hover:text-foreground">
              Integrate
            </Link>
            <Link href="#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="#infrastructure" className="hover:text-foreground">
              Infrastructure
            </Link>
          </nav>

          <p className="text-xs text-muted-foreground">
            © {year} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
