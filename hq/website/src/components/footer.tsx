import Image from "next/image";
import Link from "next/link";

import { DownloadCtaLabel } from "@/components/download-cta-label";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export function Footer() {
  const year = new Date().getFullYear();

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
            The inbox for your Cloudflare domains. Now in beta — Mac for Apple
            Silicon is available now. Intel Mac and Windows are coming soon.
          </p>

          <Button render={<Link href={siteConfig.getStartedPath} />} size="lg">
            <DownloadCtaLabel />
          </Button>

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <a
              href={siteConfig.consoleUrl + "/login"}
              className="text-muted-foreground hover:text-foreground"
            >
              Log in
            </a>
            <a
              href={siteConfig.consoleUrl + "/signup"}
              className="text-muted-foreground hover:text-foreground"
            >
              Create account
            </a>
            <a
              href={siteConfig.consoleUrl + "/account"}
              className="text-muted-foreground hover:text-foreground"
            >
              Account &amp; billing
            </a>
          </div>

          <nav className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
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
            <Link href="/release-notes" className="hover:text-foreground">
              Release notes
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
