import type { Newsletter, SubscriberGroup, SubscriberMember } from "@db/types";
import { findSubscriberGroup } from "@services/subscriber/group";
import {
  findSubscriberContactByUnsubscribeToken,
  findSubscriberContactInGroup,
  listSubscriberContactsForBroadcast,
  resolveActiveSubscriberContacts,
  subscriberActiveCountForNewsletter,
} from "@services/subscriber/resolver";
import { syncSubscriberGroupAsync } from "@services/subscriber/sync";
import {
  lookupUnsubscribeContact,
  performBroadcastUnsubscribe,
  resubscribeBroadcastContact,
} from "@services/subscriber/perform";
import {
  subscriberContactToApi,
  subscriberGroupToSummary,
} from "@services/subscriber/api-serialize";
import { mergeDataSource } from "@services/subscriber/data-source-merge";
import { fetchDataSourceContacts } from "@services/subscriber/data-source-sync";
import { setSubscriberContactSendStatus } from "@services/subscriber/send-status";
import { unsubscribeHtmlPage, unsubscribePath } from "@services/subscriber/html-page";
import { studioDocumentService } from "@services/studio/service";

export class SubscriberGroupService {
  private static instance: SubscriberGroupService;

  static getInstance(): SubscriberGroupService {
    if (!SubscriberGroupService.instance) {
      SubscriberGroupService.instance = new SubscriberGroupService();
    }
    return SubscriberGroupService.instance;
  }

  findGroup(groupId: string): SubscriberGroup | undefined {
    return findSubscriberGroup(groupId);
  }

  groupToSummary(row: SubscriberGroup) {
    return subscriberGroupToSummary(row);
  }

  findContactInGroup(groupId: string, contactId: string) {
    return findSubscriberContactInGroup(groupId, contactId);
  }

  findContactByUnsubscribeToken(groupId: string, token: string) {
    return findSubscriberContactByUnsubscribeToken(groupId, token);
  }

  resolveActiveContacts(broadcast: Newsletter): SubscriberMember[] {
    return resolveActiveSubscriberContacts(broadcast);
  }

  activeCountForNewsletter(broadcast: Newsletter): number {
    return subscriberActiveCountForNewsletter(broadcast);
  }

  listContactsForBroadcast(newsletterId: string, filters?: { status?: string; q?: string }) {
    return listSubscriberContactsForBroadcast(newsletterId, filters);
  }

  syncGroup(groupId: string, trigger: "manual" | "cron") {
    return syncSubscriberGroupAsync(groupId, trigger);
  }

  lookupUnsubscribeContact(broadcastId: string, token: string) {
    return lookupUnsubscribeContact(broadcastId, token);
  }

  performUnsubscribe(broadcastId: string, token: string) {
    return performBroadcastUnsubscribe(broadcastId, token);
  }

  resubscribe(broadcastId: string, token: string) {
    return resubscribeBroadcastContact(broadcastId, token);
  }

  contactToApi(group: SubscriberGroup, member: SubscriberMember) {
    return subscriberContactToApi(group, member);
  }

  mergeDataSource(...args: Parameters<typeof mergeDataSource>) {
    return mergeDataSource(...args);
  }

  fetchDataSourceContacts(...args: Parameters<typeof fetchDataSourceContacts>) {
    return fetchDataSourceContacts(...args);
  }

  setContactSendStatus(...args: Parameters<typeof setSubscriberContactSendStatus>) {
    return setSubscriberContactSendStatus(...args);
  }

  unsubscribeHtmlPage(input: Parameters<typeof unsubscribeHtmlPage>[0]) {
    return unsubscribeHtmlPage(input);
  }

  unsubscribePath(broadcastId: string, token: string) {
    return unsubscribePath(broadcastId, token);
  }

  readDocument() {
    return studioDocumentService.read();
  }

  mutateDocument(mutator: Parameters<typeof studioDocumentService.mutate>[0]) {
    return studioDocumentService.mutate(mutator);
  }
}

export const subscriberGroupService = SubscriberGroupService.getInstance();
