import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/footer";
import { JsonLd } from "@/components/json-ld";
import { ReleaseNoteArticle } from "@/components/release-note-article";
import { SiteHeader } from "@/components/site-header";
import { getAllReleaseNotes } from "@/lib/release-notes";
import { pageSocialMeta, siteConfig } from "@/lib/site-config";

export const dynamic = "force-static";

const title = "Release notes";
const description =
  "What's new in each Relaybase Mac and Worker release — sourced from the product changelog.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/release-notes",
  },
  ...pageSocialMeta({
    title: `Release notes · ${siteConfig.name}`,
    description: `What's new in each Relaybase Mac and Worker release.`,
    path: "/release-notes",
  }),
};

export default function ReleaseNotesPage() {
  const notes = getAllReleaseNotes();

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: `${siteConfig.url}/release-notes`,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: notes.map((note, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteConfig.url}/release-notes#v${note.version}`,
        name: note.title,
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
              Changelog
            </p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.03em] md:text-5xl">
              Release notes
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
              Product updates for the Relaybase Mac app and Worker. Same notes
              used by in-app auto-update.
            </p>
            {notes.length > 0 ? (
              <nav
                aria-label="Jump to version"
                className="mt-8 flex flex-wrap gap-2"
              >
                {notes.map((note) => (
                  <Link
                    key={note.version}
                    href={`#v${note.version}`}
                    className="rounded-lg border border-border/80 bg-panel/40 px-3 py-1.5 font-mono text-sm text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground"
                  >
                    v{note.version}
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        </section>

        <section className="py-12 md:py-16">
          <div className="mx-auto max-w-3xl space-y-12 px-6">
            {notes.length === 0 ? (
              <p className="text-muted-foreground">No release notes yet.</p>
            ) : (
              notes.map((note, index) => (
                <ReleaseNoteArticle
                  key={note.version}
                  note={note}
                  latest={index === 0}
                />
              ))
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
