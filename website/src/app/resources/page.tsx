import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { SiteHeader } from "@/components/site-header";
import { getAllResources } from "@/lib/resources";
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

const title = "Resources";
const description =
  "Guides on product email infrastructure — billing@ and support@ costs, transactional vs. inbound email, Cloudflare Email Routing, and multi-product API keys.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/resources",
  },
  ...pageSocialMeta({
    title: `Resources · ${siteConfig.name}`,
    description,
    path: "/resources",
  }),
};

export default function ResourcesPage() {
  const resources = getAllResources();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${siteConfig.url}/resources`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: resources.map((resource, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteConfig.url}/resources/${resource.slug}`,
        name: resource.title,
      })),
    },
  };

  return (
    <>
      <JsonLd data={structuredData} />
      <SiteHeader />
      <main>
        <section className="border-b border-border/60">
          <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-muted">
              Resources
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">
              Product email, explained
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Guides on the standard addresses every product needs, why seat
              pricing doesn&apos;t fit them, and how send-and-receive email
              infrastructure works on your own domain.
            </p>
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl px-6">
            {resources.length === 0 ? (
              <p className="text-muted-foreground">
                No resources published yet.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {resources.map((resource) => (
                  <li key={resource.slug}>
                    <Link
                      href={`/resources/${resource.slug}`}
                      className="group flex items-start gap-4 py-6 transition-colors hover:bg-panel/40 -mx-4 px-4 rounded-lg sm:items-center"
                    >
                      {resource.image ? (
                        <div className="hidden h-16 w-24 shrink-0 overflow-hidden rounded-lg border border-border/60 sm:block">
                          <Image
                            src={resource.image}
                            alt={resource.imageAlt ?? resource.title}
                            width={192}
                            height={128}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                      <div className="flex flex-1 items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <h2 className="text-lg font-semibold tracking-tight text-foreground">
                            {resource.title}
                          </h2>
                          <p className="text-sm leading-relaxed text-muted-foreground">
                            {resource.description}
                          </p>
                        </div>
                        <ArrowRight className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-brand" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
