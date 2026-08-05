import type { Metadata } from "next";

const defaultSiteUrl = "https://relaybase.xyz";
const defaultApiUrl = "https://api.relaybase.xyz";

export const siteConfig = {
  name: "Relaybase",
  tagline: "Every product email. One flat price.",
  description:
    "Spin up billing, support, privacy, no-reply, hello, and admin addresses for every product you ship — send and receive with a few lines of code. $10/month per domain. Built on Cloudflare.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
  apiUrl: process.env.NEXT_PUBLIC_RELAYBASE_API_URL ?? defaultApiUrl,
  getStartedPath: "/get-started",
  pricing: {
    monthly: 10,
    currency: "USD",
  },
  waitlist: {
    monthly: 5,
    discountPercent: 50,
    durationYears: 1,
    maxDomains: 50,
  },
  keywords: [
    "Relaybase",
    "transactional email API",
    "inbound email API",
    "product email infrastructure",
    "multi-product email",
    "billing@ support@ email",
    "cheap transactional email",
    "Cloudflare email sending",
    "developer email API",
    "no-reply email service",
  ],
  ogImage: {
    url: "/og.svg",
    width: 1200,
    height: 630,
    alt: "Relaybase — product email for builders",
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
  googleWorkspace: {
    plan: "Business Starter",
    perUserMonthly: 7,
    usersForSixAddresses: 6,
  },
} as const;

export function getGoogleWorkspaceMonthlyCost() {
  return (
    siteConfig.googleWorkspace.perUserMonthly *
    siteConfig.googleWorkspace.usersForSixAddresses
  );
}

export function getMonthlySavings() {
  return getGoogleWorkspaceMonthlyCost() - siteConfig.pricing.monthly;
}

export function getAnnualSavings() {
  return getMonthlySavings() * 12;
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
