import type { Metadata } from "next";

import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { LegalArticle } from "@/components/legal-article";
import { SiteHeader } from "@/components/site-header";
import { formatLegalDate, getLegalDoc } from "@/lib/legal";
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

export function generateMetadata(): Metadata {
  const doc = getLegalDoc("privacy");

  return {
    title: doc?.title ?? "Privacy Policy",
    description: doc?.description ?? "",
    alternates: {
      canonical: "/privacy",
    },
    ...pageSocialMeta({
      title: `${doc?.title ?? "Privacy Policy"} · ${siteConfig.name}`,
      description: doc?.description ?? "",
      path: "/privacy",
    }),
  };
}

export default function PrivacyPage() {
  const doc = getLegalDoc("privacy");
  if (!doc) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      {
        "@type": "ListItem",
        position: 2,
        name: doc.title,
        item: `${siteConfig.url}/privacy`,
      },
    ],
  };

  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader />
      <main>
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-muted">
              Legal
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">
              {doc.title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              {doc.description}
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              Last updated: {formatLegalDate(doc.date)}
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-6">
            <LegalArticle markdown={doc.markdown} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
