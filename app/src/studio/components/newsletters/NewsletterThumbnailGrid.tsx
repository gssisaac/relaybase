"use client";

import Link from "next/link";

import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { NewsletterThumbnailPreview } from "@/studio/components/newsletters/NewsletterThumbnailPreview";
import { newsletterDetailHref } from "@/studio/lib/paths";
import { resolveMessageLayout } from "@/studio/components/messages/MessageThumbnailGrid";
import { studioGalleryGridClassName } from "@/studio/lib/gallery/studio-gallery-grid";
import type { Newsletter, StudioLayout } from "@/studio/api";
import { newsletterDisplaySubject } from "@/studio/lib/newsletters/newsletter-display-subject";
import { cn } from "@/lib/utils";

function formatCardDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function NewsletterThumbnailGrid({
  newsletters,
  layouts,
  statsLine,
  className,
}: {
  newsletters: Newsletter[];
  layouts: StudioLayout[];
  statsLine: (newsletter: Newsletter) => string;
  className?: string;
}) {
  return (
    <ul className={cn(studioGalleryGridClassName, className)}>
      {newsletters.map((newsletter) => {
        const layout = resolveMessageLayout(newsletter, layouts);
        const href = newsletterDetailHref(newsletter.id);
        return (
          <li key={newsletter.id} className="flex min-h-0 min-w-0">
            <div className="group flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-lg border bg-card transition hover:border-primary/40 hover:shadow-sm">
              <Link href={href} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
                <NewsletterThumbnailPreview
                  newsletterId={newsletter.id}
                  newsletter={newsletter}
                  layout={layout}
                />
                <div className="space-y-1.5 border-t px-3 py-2.5">
                  <p className="truncate text-sm font-medium">
                    {newsletterDisplaySubject(newsletter.subject)}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{statsLine(newsletter)}</p>
                </div>
              </Link>
              <div className="mt-auto flex items-center justify-between gap-2 border-t px-3 py-2">
                <NewsletterStatusBadge
                  status={newsletter.status}
                  listStatus={newsletter.listStatus}
                />
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatCardDate(newsletter.updatedAt)}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
