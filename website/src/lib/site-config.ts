import type { Metadata } from "next";

const defaultSiteUrl = "https://relaybase.xyz";
const defaultApiUrl = "https://api.relaybase.xyz";

export const siteConfig = {
  name: "Relaybase",
  tagline: "The inbox for your Cloudflare domains.",
  description:
    "A keyboard-first Mac inbox for every domain on your Cloudflare account — as a Worker you own.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
  apiUrl: process.env.NEXT_PUBLIC_RELAYBASE_API_URL ?? defaultApiUrl,
  getStartedPath: "/get-started",
  /**
   * Pricing numbers — source of truth is `PRICING.md` (repo root). Only
   * `free`, `pro`, and `earlyAccess` are public; Team/Studio exist in the
   * model (`STRATEGY.md` §3) but are not shown on the site until they ship.
   */
  pricing: {
    currency: "USD",
    free: {
      label: "Free",
      price: 0,
      domains: 1,
      addresses: 1,
    },
    pro: {
      label: "Pro",
      /** One-time license price (USD), post-launch regular price. */
      price: 69,
      /** Optional annual update renewal — perpetual fallback if skipped. */
      renewalPrice: 25,
      renewalPeriodLabel: "year",
    },
    /**
     * Pre-launch only (`PRE-LAUNCH.md` §4). Same Pro feature set, discounted
     * price, capped seats. Set `active: false` once seats fill or the product
     * exits Early Access — the site should then fall back to `pro.price`.
     */
    earlyAccess: {
      label: "Pro — Early Access",
      price: 35,
      seatsTotal: 300,
      active: true,
    },
  },
  waitlist: {
    note: "Early Access pricing for the first 300",
  },
  keywords: [
    "Relaybase",
    "Cloudflare email client",
    "Cloudflare Email Sending",
    "Cloudflare Email Routing",
    "product email Mac app",
    "transactional email API",
    "inbound email API",
    "billing@ support@ email",
    "BYO Cloudflare",
    "multi-domain email manager",
  ],
  ogImage: {
    url: "/og.svg",
    width: 1200,
    height: 630,
    alt: "Relaybase — the inbox for your Cloudflare domains",
    type: "image/svg+xml",
  },
  standardAddresses: [
    { role: "billing", address: "billing@yourdomain.com", purpose: "Invoices, receipts, payment updates" },
    { role: "support", address: "support@yourdomain.com", purpose: "Customer help and ticket intake" },
    { role: "privacy", address: "privacy@yourdomain.com", purpose: "GDPR requests and data inquiries" },
    { role: "no-reply", address: "noreply@yourdomain.com", purpose: "Password resets and notifications" },
    { role: "hello", address: "hello@yourdomain.com", purpose: "Welcome emails and onboarding" },
    { role: "admin", address: "admin@yourdomain.com", purpose: "Internal alerts and ops notices" },
  ],
  cloudflareEmailSendingMonthly: 5,
} as const;

/** Single flag every page should branch on to show/hide Early Access framing. */
export function isEarlyAccessActive() {
  return siteConfig.pricing.earlyAccess.active;
}

/** The price to lead with in CTAs — Early Access price while it's running, regular price after. */
export function getCurrentProPrice() {
  return isEarlyAccessActive()
    ? siteConfig.pricing.earlyAccess.price
    : siteConfig.pricing.pro.price;
}

/**
 * Next.js metadata does not deep-merge nested `openGraph` / `twitter` objects —
 * a page that sets its own `openGraph` without `images` silently loses the root
 * OG image, and a page without `twitter` inherits the *root* Twitter card
 * title/description instead of its own. Every page-level metadata export should
 * build its social tags through this helper so OG + Twitter always stay in sync.
 */
export function pageSocialMeta({
  title,
  description,
  path,
  type = "website",
  locale = "en_US",
  image,
  article,
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
  locale?: string;
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
    type?: string;
  };
  /** Only used when `type` is `"article"` — sets OG article publish/update dates. */
  article?: {
    publishedTime: string;
    modifiedTime?: string;
  };
}): Pick<Metadata, "openGraph" | "twitter"> {
  const ogImage = image ?? siteConfig.ogImage;
  const url = `${siteConfig.url}${path}`;
  const images = [
    {
      url: ogImage.url,
      width: ogImage.width,
      height: ogImage.height,
      alt: ogImage.alt,
      type: "type" in ogImage ? ogImage.type : undefined,
    },
  ];

  const openGraph: Metadata["openGraph"] =
    type === "article"
      ? {
          title,
          description,
          url,
          siteName: siteConfig.name,
          locale,
          type: "article",
          publishedTime: article?.publishedTime,
          modifiedTime: article?.modifiedTime,
          images,
        }
      : {
          title,
          description,
          url,
          siteName: siteConfig.name,
          locale,
          type: "website",
          images,
        };

  return {
    openGraph,
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}
