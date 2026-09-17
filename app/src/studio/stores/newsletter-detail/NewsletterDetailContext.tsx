"use client";

import * as React from "react";
import { reaction } from "mobx";

import {
  NewsletterDetailStore,
  type NewsletterDraftFields,
} from "./newsletter-detail-store";
import type { Newsletter, NewsletterMember, StudioLayout } from "@/studio/api";

const NewsletterDetailStoreContext = React.createContext<NewsletterDetailStore | null>(null);

export function NewsletterDetailProvider({
  newsletterId,
  children,
}: {
  newsletterId: string;
  children: React.ReactNode;
}) {
  const storeRef = React.useRef<NewsletterDetailStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new NewsletterDetailStore();
  }
  const store = storeRef.current;

  React.useEffect(() => {
    store.mount(newsletterId);
    return () => store.unmount();
  }, [store, newsletterId]);

  return (
    <NewsletterDetailStoreContext.Provider value={store}>
      {children}
    </NewsletterDetailStoreContext.Provider>
  );
}

export function useNewsletterDetailStore(): NewsletterDetailStore {
  const store = React.useContext(NewsletterDetailStoreContext);
  if (!store) throw new Error("NewsletterDetailProvider required");
  return store;
}

type NewsletterDetailHookValue = {
  newsletterId: string;
  newsletter: Newsletter | null;
  templates: StudioLayout[];
  subscriberMembers: NewsletterMember[];
  loading: boolean;
  refreshing: boolean;
  notFound: boolean;
  setNewsletter: (newsletter: Newsletter) => void;
  refresh: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshSubscribers: () => Promise<void>;
  syncDraft: (fields: NewsletterDraftFields) => void;
  persistDraft: () => Promise<boolean>;
  getLastSavedDraft: () => NewsletterDraftFields;
};

/**
 * MobX-backed newsletter detail with a React subscription for non-observer components.
 */
export function useNewsletterDetail(): NewsletterDetailHookValue {
  const store = useNewsletterDetailStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        newsletterId: store.newsletterId,
        newsletter: store.newsletter,
        templates: store.templates,
        subscriberMembers: store.subscriberMembers,
        loading: store.loading,
        refreshing: store.refreshing,
        notFound: store.notFound,
        sendInFlight: store.sendInFlight,
        dispatch: store.dispatch,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return {
    newsletterId: store.newsletterId,
    newsletter: store.newsletter,
    templates: store.templates,
    subscriberMembers: store.subscriberMembers,
    loading: store.loading,
    refreshing: store.refreshing,
    notFound: store.notFound,
    setNewsletter: store.setNewsletter,
    refresh: store.refresh,
    refreshTemplates: store.refreshTemplates,
    refreshSubscribers: store.refreshSubscribers,
    syncDraft: store.syncDraft,
    persistDraft: store.persistDraft,
    getLastSavedDraft: store.getLastSavedDraft,
  };
}

export type { NewsletterDraftFields };

/** Stats tab — subscribes to dispatch progress and recipient rows on the detail store. */
export function useNewsletterDetailStats() {
  const store = useNewsletterDetailStore();
  const [, setTick] = React.useState(0);

  React.useEffect(() => {
    return reaction(
      () => ({
        status: store.newsletter?.status,
        dispatch: store.dispatch,
        recipientCount: store.recipients.length,
        eventCount: store.trackingEvents.length,
        linkCount: store.linkClicks.length,
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return {
    newsletter: store.newsletter,
    dispatch: store.dispatch,
    recipients: store.recipients,
    trackingEvents: store.trackingEvents,
    linkClicks: store.linkClicks,
    refresh: store.refresh,
  };
}
