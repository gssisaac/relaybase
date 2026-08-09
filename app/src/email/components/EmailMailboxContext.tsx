"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { reaction } from "mobx";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useMailAccounts } from "@/email/components/MailAccountsContext";
import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import { useEmailPaths } from "@/email/paths";
import { EmailMailboxStore } from "@/email/email-mailbox-store";
import type { TrashEntry, TrashKind } from "@/email/trash-store";
import type {
  Address,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/types";

export type EmailMailboxContextValue = {
  config: EmailConfig | null;
  addresses: Address[];
  activity: RoutingActivityEvent[];
  sent: SentEmail[];
  trash: TrashEntry[];
  trashedActivity: RoutingActivityEvent[];
  trashedSent: SentEmail[];
  accountFilter: EmailAccountFilter;
  setAccountFilter: (value: EmailAccountFilter) => void;
  openAccounts: string[];
  setOpenAccounts: (
    value: string[] | ((prev: string[]) => string[]),
  ) => void;
  inboxCount: number;
  sentCount: number;
  trashCount: number;
  unreadCount: number;
  isUnread: (key: string) => boolean;
  unreadCountForAccount: (email: string) => number;
  markRead: (key: string) => void;
  markUnread: (key: string) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setError: (value: string | null) => void;
  refresh: (force?: boolean) => Promise<void>;
  moveToTrash: (kind: TrashKind, id: string) => void;
  restoreFromTrash: (kind: TrashKind, id: string) => void;
  emptyTrash: () => void;
  relaybaseOk: boolean;
  /** Direct store access for observer components. */
  store: EmailMailboxStore;
};

const EmailMailboxStoreContext = createContext<EmailMailboxStore | null>(
  null,
);

function storeHasUnreadApi(store: EmailMailboxStore) {
  return (
    typeof store.upsertDraft === "function" &&
    typeof store.removeDraft === "function" &&
    Array.isArray(store.drafts) &&
    typeof store.isUnread === "function" &&
    typeof store.markRead === "function" &&
    typeof store.markUnread === "function" &&
    typeof store.unreadCountForAccount === "function" &&
    typeof store.pollInboxNotifications === "function" &&
    Array.isArray(store.readKeys)
  );
}

export function EmailMailboxProvider({ children }: { children: ReactNode }) {
  const productId = useProductId();
  const { apiBase } = useEmailPaths();
  const { enabledAddresses, enabledAccounts, availableAddresses } =
    useMailAccounts();
  const [store, setStore] = useState(() => new EmailMailboxStore());

  // Turbopack/HMR keeps the old MobX instance after EmailMailboxStore gains
  // new methods — replace during render so callers never see a stale API.
  let liveStore = store;
  if (!storeHasUnreadApi(store)) {
    liveStore = new EmailMailboxStore();
    setStore(liveStore);
  }

  useEffect(() => {
    liveStore.start();
    return () => {
      liveStore.stop();
    };
  }, [liveStore]);

  useEffect(() => {
    liveStore.configure({
      productId,
      apiBase,
      enabledAccounts,
      enabledAddresses,
      availableAddresses,
    });
  }, [
    liveStore,
    productId,
    apiBase,
    enabledAccounts,
    enabledAddresses,
    availableAddresses,
  ]);

  return (
    <EmailMailboxStoreContext.Provider value={liveStore}>
      {children}
    </EmailMailboxStoreContext.Provider>
  );
}

export function useEmailMailboxStore(): EmailMailboxStore {
  const store = useContext(EmailMailboxStoreContext);
  if (!store) {
    throw new Error("useEmailMailboxStore requires EmailMailboxProvider");
  }
  return store;
}

/**
 * Compatibility hook: subscribes to mailbox observables so non-observer
 * components still re-render when the MobX store updates.
 */
export function useEmailMailbox(): EmailMailboxContextValue {
  const store = useEmailMailboxStore();
  const [, setTick] = useState(0);

  useEffect(() => {
    return reaction(
      () => ({
        config: store.config,
        activity: store.activity.map((m) => m.key),
        sent: store.sent.map((m) => m.id),
        drafts: store.drafts.map((d) => `${d.id}:${d.updatedAt}`),
        addresses: store.addresses.map((a) => a.email),
        trash: store.trash.map((t) => `${t.kind}:${t.id}`),
        accountFilter: store.accountFilter,
        openAccounts: store.openAccounts.slice(),
        inboxCount: store.inboxCount,
        sentCount: store.sentCount,
        trashCount: store.trashCount,
        unreadCount: store.unreadCount,
        readKeys: store.readKeys.slice(),
        loading: store.loading,
        refreshing: store.refreshing,
        error: store.error,
        relaybaseOk: store.relaybaseOk,
        detailKeys: Object.keys(store.activityDetailByKey),
        detailLoadingKey: store.detailLoadingKey,
        enabledAccounts: store.enabledAccounts.slice(),
      }),
      () => setTick((t) => t + 1),
    );
  }, [store]);

  return {
    config: store.config,
    addresses: store.visibleAddresses,
    activity: store.visibleActivity,
    sent: store.visibleSent,
    trash: store.trash,
    trashedActivity: store.trashedActivity,
    trashedSent: store.trashedSent,
    accountFilter: store.accountFilter,
    setAccountFilter: store.setAccountFilter,
    openAccounts: store.openAccounts,
    setOpenAccounts: store.setOpenAccounts,
    inboxCount: store.inboxCount,
    sentCount: store.sentCount,
    trashCount: store.trashCount,
    unreadCount: store.unreadCount,
    isUnread: store.isUnread,
    unreadCountForAccount: store.unreadCountForAccount,
    markRead: store.markRead,
    markUnread: store.markUnread,
    loading: store.loading,
    refreshing: store.refreshing,
    error: store.error,
    setError: store.setError,
    refresh: store.refresh,
    moveToTrash: store.moveToTrash,
    restoreFromTrash: store.restoreFromTrash,
    emptyTrash: store.emptyTrash,
    relaybaseOk: store.relaybaseOk,
    store,
  };
}
