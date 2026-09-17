"use client";

import { NewsletterStatusBadge } from "@/studio/components/newsletters/NewsletterStatusBadge";
import { NewsletterThumbnailPreview } from "@/studio/components/newsletters/NewsletterThumbnailPreview";
import { resolveMessageLayout } from "@/studio/components/messages/MessageThumbnailGrid";
import { newsletterDetailHref } from "@/studio/lib/paths";
import type { Newsletter, StudioLayout } from "@/studio/api";
import { newsletterDisplaySubject } from "@/studio/lib/newsletters/newsletter-display-subject";
import {
  EmailListContainer,
  EmailTableHeader,
  EmailTableRow,
} from "@/email/components/mailbox/EmailListShell";

function formatListDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NewsletterListTableThumb({
  newsletter,
  layout,
}: {
  newsletter: Newsletter;
  layout: StudioLayout | null;
}) {
  return (
    <div className="h-[34px] w-11 shrink-0 overflow-hidden rounded bg-muted/30">
      <NewsletterThumbnailPreview
        newsletterId={newsletter.id}
        newsletter={newsletter}
        layout={layout}
        className="size-full border-0 rounded-none bg-transparent"
        imageClassName="size-full object-cover object-top"
      />
    </div>
  );
}

export function NewsletterListTable({
  newsletters,
  layouts,
  statsLine,
}: {
  newsletters: Newsletter[];
  layouts: StudioLayout[];
  statsLine: (newsletter: Newsletter) => string;
}) {
  return (
    <EmailListContainer plain>
      <EmailTableHeader>
        <span>Newsletter</span>
        <span className="hidden sm:block">Stats</span>
        <span className="hidden sm:block">Updated</span>
        <span className="text-right">Status</span>
      </EmailTableHeader>
      <div>
        {newsletters.map((newsletter) => {
          const layout = resolveMessageLayout(newsletter, layouts);
          return (
            <EmailTableRow
              key={newsletter.id}
              href={newsletterDetailHref(newsletter.id)}
              avatar={
                <NewsletterListTableThumb newsletter={newsletter} layout={layout} />
              }
              primary={newsletterDisplaySubject(newsletter.subject)}
              subject={newsletter.subject.trim() || "No subject"}
              preview={statsLine(newsletter)}
              date={formatListDate(newsletter.updatedAt)}
              status={
                <NewsletterStatusBadge
                  status={newsletter.status}
                  listStatus={newsletter.listStatus}
                />
              }
            />
          );
        })}
      </div>
    </EmailListContainer>
  );
}
