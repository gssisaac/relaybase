import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { ResourceArticle } from "@/components/resource-article";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getAllResources, getResource } from "@/lib/resources";
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

type ResourcePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return getAllResources().map((resource) => ({ slug: resource.slug }));
}

export async function generateMetadata({
  params,
}: ResourcePageProps): Promise<Metadata> {
  const { slug } = await params;
  const resource = getResource(slug);

  if (!resource) {
    return { title: "Resource not found" };
  }

  const ogImage = resource.image
    ? {
        url: resource.image,
        width: 1200,
        height: 630,
        alt: resource.imageAlt ?? resource.title,
      }
    : siteConfig.ogImage;

  return {
    title: resource.title,
    description: resource.description,
    alternates: {
      canonical: `/resources/${resource.slug}`,
    },
    ...pageSocialMeta({
      title: `${resource.title} · ${siteConfig.name}`,
      description: resource.description,
      path: `/resources/${resource.slug}`,
      type: "article",
      image: ogImage,
      article: {
        publishedTime: resource.date,
        modifiedTime: resource.updated ?? resource.date,
      },
    }),
  };
}

export default async function ResourcePage({ params }: ResourcePageProps) {
  const { slug } = await params;
  const resource = getResource(slug);

  if (!resource) {
    notFound();
  }

  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: resource.title,
      description: resource.description,
      url: `${siteConfig.url}/resources/${resource.slug}`,
      image: resource.image
        ? `${siteConfig.url}${resource.image}`
        : `${siteConfig.url}${siteConfig.ogImage.url}`,
      datePublished: resource.date,
      dateModified: resource.updated ?? resource.date,
      author: {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
      },
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
        {
          "@type": "ListItem",
          position: 2,
          name: "Resources",
          item: `${siteConfig.url}/resources`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: resource.title,
          item: `${siteConfig.url}/resources/${resource.slug}`,
        },
      ],
    },
  ];

  return (
    <>
      <SiteHeader />
      <main>
        <article>
          <section className="border-b border-border/60">
            <div className="mx-auto max-w-3xl px-6 py-16 md:py-20">
              <h1 className="text-3xl font-extrabold tracking-[-0.03em] md:text-4xl">
                {resource.title}
              </h1>
              {resource.description ? (
                <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                  {resource.description}
                </p>
              ) : null}
            </div>
          </section>

          <section className="py-12 md:py-16">
            <div className="mx-auto max-w-3xl px-6">
              {resource.image ? (
                <div className="mb-10 overflow-hidden rounded-2xl border border-border/60">
                  <Image
                    src={resource.image}
                    alt={resource.imageAlt ?? resource.title}
                    width={1200}
                    height={630}
                    className="h-auto w-full"
                    priority
                  />
                </div>
              ) : null}
              <ResourceArticle markdown={resource.markdown} />

              <div className="mt-14 flex flex-col items-start gap-4 rounded-2xl border border-brand/20 bg-brand/5 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">
                    Ready to ship your own billing@ and support@?
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Join the waitlist and lock in ${siteConfig.waitlist.monthly}
                    /mo per domain for your first {siteConfig.waitlist.durationYears}{" "}
                    year.
                  </p>
                </div>
                <Button size="lg" render={<Link href={siteConfig.getStartedPath} />}>
                  Join waitlist
                </Button>
              </div>
            </div>
          </section>
        </article>
      </main>
      <Footer />
      <JsonLd data={structuredData} />
    </>
  );
}
