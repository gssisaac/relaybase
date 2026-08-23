import { CloudflareTrust } from "@/components/cloudflare-trust";
import { CodeEmbed } from "@/components/code-embed";
import { EmailAddresses } from "@/components/email-addresses";
import { FeatureWalkthrough } from "@/components/feature-walkthrough";
import { Features } from "@/components/features";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { IntroVideo } from "@/components/intro-video";
import { JsonLd } from "@/components/json-ld";
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
      operatingSystem: "macOS",
      description: siteConfig.description,
      url: siteConfig.url,
      image: ogImageUrl,
      featureList: [
        "Mac app for Cloudflare Email Sending and Routing",
        "Worker installed in your Cloudflare account",
        "Transactional send API and inbound webhooks",
        "billing@, support@, privacy@, noreply@, hello@, admin@ addresses",
        "Multi-domain management on your CF zones",
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
        <IntroVideo />
        <EmailAddresses />
        <FeatureWalkthrough />
        <UseCases />
        <CodeEmbed />
        <Features />
        <CloudflareTrust />
      </main>
      <Footer />
    </>
  );
}
