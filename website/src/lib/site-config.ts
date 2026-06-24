const defaultSiteUrl = "https://relaybase.com";

export const siteConfig = {
  name: "Relaybase",
  tagline: "Every product email. One flat price.",
  description:
    "Spin up billing, support, privacy, no-reply, hello, and admin addresses for every product you ship — send and receive with a few lines of code. $10/month per domain. Built on Cloudflare.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? defaultSiteUrl,
  pricing: {
    monthly: 10,
    currency: "USD",
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
