import type { NewsletterListStatus, NewsletterStatus } from "@/studio/api";

export type NewsletterFilter =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "archived"
  | "all";

export const NEWSLETTER_FILTER_OPTIONS: { value: NewsletterFilter; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sending", label: "In progress" },
  { value: "sent", label: "Sent" },
  { value: "archived", label: "Archived" },
  { value: "all", label: "All" },
];

export function newsletterFilterLabel(filter: NewsletterFilter): string {
  return NEWSLETTER_FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter;
}

export function matchesNewsletterFilter(
  status: NewsletterStatus,
  filter: NewsletterFilter,
): boolean {
  switch (filter) {
    case "draft":
      return status === "draft";
    case "scheduled":
      return status === "scheduled";
    case "sending":
      return status === "sending";
    case "sent":
      return status === "sent";
    case "archived":
    case "all":
    default:
      return true;
  }
}

export type NewsletterFilterCounts = Record<NewsletterFilter, number>;

export function countNewslettersByFilter(
  newsletters: Array<{ status: NewsletterStatus; listStatus: NewsletterListStatus }>,
): NewsletterFilterCounts {
  const active = newsletters.filter((b) => b.listStatus !== "archived");
  const archived = newsletters.filter((b) => b.listStatus === "archived");
  return {
    draft: active.filter((b) => b.status === "draft").length,
    scheduled: active.filter((b) => b.status === "scheduled").length,
    sending: active.filter((b) => b.status === "sending").length,
    sent: active.filter((b) => b.status === "sent").length,
    archived: archived.length,
    all: active.length,
  };
}
