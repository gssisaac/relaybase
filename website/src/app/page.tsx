import { CloudflareTrust } from "@/components/cloudflare-trust";
import { CodeEmbed } from "@/components/code-embed";
import { EmailAddresses } from "@/components/email-addresses";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { JsonLd } from "@/components/json-ld";
import { PricingComparison } from "@/components/pricing-comparison";
import { SiteHeader } from "@/components/site-header";
import { UseCases } from "@/components/use-cases";
import { siteConfig } from "@/lib/site-config";

export default function Home() {
  const ogImageUrl = new URL(siteConfig.ogImage.url, siteConfig.url).toString();

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: siteConfig.name,
      url: siteConfig.url,
      description: siteConfig.description,
      inLanguage: "en-US",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: siteConfig.description,
      url: siteConfig.url,
      image: ogImageUrl,
      offers: {
        "@type": "Offer",
        price: String(siteConfig.pricing.monthly),
        priceCurrency: siteConfig.pricing.currency,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: String(siteConfig.pricing.monthly),
          priceCurrency: siteConfig.pricing.currency,
          unitText: "MONTH",
        },
      },
      featureList: [
        "Transactional email send API",
        "Inbound email receive with webhooks",
        "billing@, support@, privacy@, noreply@, hello@, admin@ addresses",
        "Multi-product domain management",
        "Cloudflare-powered infrastructure",
        "Domain-scoped API keys",
      ],
    },
  ];

  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader />
      <main>
        <Hero />
        <EmailAddresses />
        <UseCases />
        <PricingComparison />
        <CodeEmbed />
        <Features />
        <CloudflareTrust />
      </main>
      <Footer />
    </>
  );
}
