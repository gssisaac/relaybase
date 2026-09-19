import type { Newsletter, SubscriberMember } from "@db/types";
import { studioDocumentService } from "@services/studio/service";
import { newsletterFromEntity, newsletterToEntity } from "@services/newsletter/mapper";
import {
  findNewsletter,
  getNewsletterLayoutHtml,
  getNewsletterLayoutSchema,
  serializeNewsletter,
} from "@services/newsletter/serialize";
import { claimNewsletterForSend, resolveTestSendUnsubscribeToken } from "@services/newsletter/send-claim";
import {
  dispatchNewsletterToSubscribers,
  processNewsletterDispatchBatch,
} from "@services/newsletter/dispatch";
import { buildNewsletterDispatchProgress } from "@services/newsletter/dispatch-progress";
import { aggregateNewsletterLinkClicks } from "@services/newsletter/link-clicks";
import { buildNewsletterInProgressOverview, buildSentOverview } from "@services/newsletter/overview";
import {
  emptyNewsletterStats,
  normalizeNewsletterStats,
  rollupNewsletterStatsFromRecipients,
} from "@services/newsletter/stats";
import {
  DISPATCH_BATCH_SIZE,
  DISPATCH_QUEUE_POLL_MS,
} from "@services/newsletter/dispatch-progress";
import { slugifyNewsletter } from "@services/newsletter/slug";
import { newsletterSubject } from "@services/newsletter/subject";
import { refreshNewsletterSubscriberLink } from "@services/newsletter/subscriber-sync";
import { serializeNewsletterSubscriberContact } from "@services/newsletter/subscriber-api-serialize";
import { studioRepos } from "@services/repositories";

export class NewsletterService {
  private static instance: NewsletterService;

  static getInstance(): NewsletterService {
    if (!NewsletterService.instance) {
      NewsletterService.instance = new NewsletterService();
    }
    return NewsletterService.instance;
  }

  findInDocument(id: string): Newsletter | undefined {
    return findNewsletter(id);
  }

  findById(accountLinkId: string, id: string): Newsletter | undefined {
    const row = findNewsletter(id);
    if (!row || row.accountLinkId !== accountLinkId) return undefined;
    return row;
  }

  layoutHtml(layoutId: string | null | undefined) {
    return getNewsletterLayoutHtml(layoutId);
  }

  layoutSchema(layoutId: string | null | undefined) {
    return getNewsletterLayoutSchema(layoutId);
  }

  slugify(name: string) {
    return slugifyNewsletter(name);
  }

  emptyStats() {
    return emptyNewsletterStats();
  }

  dispatchProgress(input: Parameters<typeof buildNewsletterDispatchProgress>[0]) {
    return buildNewsletterDispatchProgress(input);
  }

  resolveTestSendUnsubscribeToken(broadcast: Newsletter, toEmail: string) {
    return resolveTestSendUnsubscribeToken(broadcast, toEmail);
  }

  refreshSubscriberLink(...args: Parameters<typeof refreshNewsletterSubscriberLink>) {
    return refreshNewsletterSubscriberLink(...args);
  }

  serializeSubscriberContact(...args: Parameters<typeof serializeNewsletterSubscriberContact>) {
    return serializeNewsletterSubscriberContact(...args);
  }

  subject(data: Parameters<typeof newsletterSubject>[0], row: Newsletter) {
    return newsletterSubject(data, row);
  }

  readDocument() {
    return studioDocumentService.read();
  }

  mutateDocument(mutator: Parameters<typeof studioDocumentService.mutate>[0]) {
    return studioDocumentService.mutate(mutator);
  }

  async findByIdFromDb(accountLinkId: string, id: string): Promise<Newsletter | null> {
    const row = await studioRepos.newsletter().findOne({ where: { id, accountLinkId } });
    return row ? newsletterFromEntity(row) : null;
  }

  async listForAccount(accountLinkId: string): Promise<Newsletter[]> {
    const rows = await studioRepos.newsletter().find({ where: { accountLinkId } });
    return rows.map(newsletterFromEntity);
  }

  serialize(row: Newsletter) {
    return serializeNewsletter(row);
  }

  claimForSend(newsletterId: string) {
    return claimNewsletterForSend(newsletterId);
  }

  dispatchToSubscribers(broadcast: Newsletter, members: SubscriberMember[]) {
    return dispatchNewsletterToSubscribers(broadcast, members);
  }

  processDispatchBatch(newsletterId: string, limit: number) {
    return processNewsletterDispatchBatch(newsletterId, limit);
  }

  linkClickAggregate(newsletterId: string) {
    return aggregateNewsletterLinkClicks(newsletterId);
  }

  buildSentOverview(input: Parameters<typeof buildSentOverview>[0]) {
    return buildSentOverview(input);
  }

  buildInProgressOverview(input: Parameters<typeof buildNewsletterInProgressOverview>[0]) {
    return buildNewsletterInProgressOverview(input);
  }

  normalizeStats(stats: Newsletter["stats"]) {
    return normalizeNewsletterStats(stats);
  }

  rollupStatsFromRecipients(
    recipients: Parameters<typeof rollupNewsletterStatsFromRecipients>[0],
    events: Parameters<typeof rollupNewsletterStatsFromRecipients>[1],
  ) {
    return rollupNewsletterStatsFromRecipients(recipients, events);
  }

  get dispatchBatchSize() {
    return DISPATCH_BATCH_SIZE;
  }

  get dispatchQueuePollMs() {
    return DISPATCH_QUEUE_POLL_MS;
  }

  async save(newsletter: Newsletter): Promise<Newsletter> {
    const saved = await studioRepos.newsletter().save(newsletterToEntity(newsletter));
    const row = newsletterFromEntity(saved);
    studioDocumentService.mutate((draft) => {
      const idx = draft.newsletters.findIndex((n) => n.id === row.id);
      if (idx >= 0) draft.newsletters[idx] = row;
      else draft.newsletters.push(row);
    });
    return row;
  }

  async deleteById(id: string): Promise<void> {
    await studioRepos.newsletter().delete({ id });
    studioDocumentService.mutate((draft) => {
      draft.newsletters = draft.newsletters.filter((n) => n.id !== id);
    });
  }
}

export const newsletterService = NewsletterService.getInstance();
