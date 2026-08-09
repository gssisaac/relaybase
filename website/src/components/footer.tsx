import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentProPrice, isEarlyAccessActive, siteConfig } from "@/lib/site-config";

export function Footer() {
  const year = new Date().getFullYear();
  const earlyAccess = isEarlyAccessActive();
  const price = getCurrentProPrice();

  return (
    <footer className="border-t border-border bg-white">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-2.5">
            <Image
              src="/icon.png"
              alt=""
              width={32}
              height={32}
              className="size-8"
            />
            <span className="text-lg font-semibold">{siteConfig.name}</span>
          </div>

          <p className="max-w-md text-sm text-muted-foreground">
            The inbox for your Cloudflare domains. Free for one domain, or $
            {price} once for everything
            {earlyAccess
              ? ` during Early Access (normally $${siteConfig.pricing.pro.price})`
              : ""}
            .
          </p>

          <Button render={<Link href={siteConfig.getStartedPath} />} size="lg">
            Start free
          </Button>

          <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/#addresses" className="hover:text-foreground">
              Addresses
            </Link>
            <Link href="/#pricing" className="hover:text-foreground">
              Pricing
            </Link>
            <Link href="/#integrate" className="hover:text-foreground">
              Integrate
            </Link>
            <Link href="/#features" className="hover:text-foreground">
              Features
            </Link>
            <Link href="/#infrastructure" className="hover:text-foreground">
              Infrastructure
            </Link>
            <Link href="/resources" className="hover:text-foreground">
              Resources
            </Link>
          </nav>

          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
            <span>
              © {year} {siteConfig.name}. All rights reserved.
            </span>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
