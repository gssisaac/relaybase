"use client";

import { makeAutoObservable, runInAction } from "mobx";
import { toast } from "sonner";

import type { EmailAccountFilter } from "@/email/components/EmailAccountSelect";
import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/email/components/email-cached-fetch";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SEND_STARTED,
  EMAIL_SEND_SUCCEEDED,
  type EmailSendSucceededDetail,
} from "@/email/components/email-send-events";
import { readEmailStale } from "@/email/components/useEmailViewLoading";
import type {
  Address,
  DraftEmail,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/types";
import {
  loadPersistedDetail,
  loadPersistedDrafts,
  loadPersistedInbox,
  loadPersistedSent,
  savePersistedDetail,
  savePersistedDrafts,
  savePersistedInbox,
  savePersistedSent,
} from "@/email/email-disk-store";
import {
  hydrateReadKeys,
  writeReadKeys,
} from "@/email/read-store";
import {
  hydrateTrash,
  trashEntryKey,
  writeTrash,
  type TrashEntry,
  type TrashKind,
} from "@/email/trash-store";
import { inboundMatchesAccount } from "@/email/conversation-threading";
import { notifyNewMail } from "@/lib/desktop/notify";

const NOTIFICATION_POLL_MS = 20_000;
const SEND_TOAST_ID = "email-send";
const TRASH_UNDO_TOAST_ID = "mail-trash-undo";
const TRASH_UNDO_MS = 5_000;

export type InboxNotificationEvent = {
  id: string;
  type: "inbound.email.received";
  createdAt: string;
  data: {
    messageId: string;
    domain: string;
    from: string;
    to: string;
    subject: string;
    preview: string;
    receivedAt: string;
    hasAttachments: boolean;
  };
};

function domainOf(email: string) {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(at + 1).toLowerCase() : "";
}

function domainQuery(domain: string, extra?: Record<string, string>) {
  const params = new URLSearchParams({ domain, ...(extra ?? {}) });
  return `?${params.toString()}`;
}

function inboxDetailQuery(domain: string) {
  if (!domain) return "";
  return `?domain=${encodeURIComponent(domain)}`;
}

export class EmailMailboxStore {
  config: EmailConfig | null = null;
  /** Raw inbox messages (all domains); visibility filtered via computeds. */
  activity: RoutingActivityEvent[] = [];
  sent: SentEmail[] = [];
  drafts: DraftEmail[] = [];
  addresses: Address[] = [];
  trash: TrashEntry[] = [];
  accountFilter: EmailAccountFilter = "all";
  openAccounts: string[] = [];
  loading = true;
  refreshing = false;
  error: string | null = null;

  /** Cached inbox message details by key. */
  activityDetailByKey: Record<string, RoutingActivityEvent> = {};
  /** Last requested detail key (compat); prefer `isDetailLoading`. */
  detailLoadingKey: string | null = null;
  /** Keys currently loading detail. */
  detailLoadingKeys: string[] = [];

  /** Message keys the user has opened (or first-run baseline). */
  readKeys: string[] = [];
  /** False until first-run baseline or persisted read state is loaded. */
  private readStateReady = false;

  productId = "";
  apiBase = "";
  enabledAccounts: string[] = [];
  enabledAddresses: Address[] = [];
  domainsKey = "";

  private refreshGeneration = 0;
  private detailGenerationByKey = new Map<string, number>();
  private bootstrapGeneration = 0;
  private started = false;
  private bound = false;
  /** True after a successful disk hydrate or network mail fetch this session. */
  private mailReady = false;
  private notificationPollTimer: ReturnType<typeof setInterval> | null = null;
  private notificationPollInFlight = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get enabledSet(): Set<string> {
    return new Set(this.enabledAccounts.map((e) => e.toLowerCase()));
  }

  get visibleAddresses(): Address[] {
    if (this.enabledAddresses.length > 0) return this.enabledAddresses;
    const set = this.enabledSet;
    return this.addresses.filter((a) => set.has(a.email.toLowerCase()));
  }

  get trashKeys(): Set<string> {
    return new Set(
      this.trash.map((entry) => trashEntryKey(entry.kind, entry.id)),
    );
  }

  get enabledActivity(): RoutingActivityEvent[] {
    const set = this.enabledSet;
    if (set.size === 0) return [];
    return this.activity.filter((m) =>
      [...set].some((email) => inboundMatchesAccount(m, email)),
    );
  }

  get enabledSent(): SentEmail[] {
    const set = this.enabledSet;
    if (set.size === 0) return [];
    return this.sent.filter((m) => set.has(m.from.toLowerCase()));
  }

  get visibleActivity(): RoutingActivityEvent[] {
    const trashKeys = this.trashKeys;
    return this.enabledActivity.filter(
      (m) => !trashKeys.has(trashEntryKey("inbox", m.key)),
    );
  }

  get visibleSent(): SentEmail[] {
    const trashKeys = this.trashKeys;
    return this.enabledSent.filter(
      (m) => !trashKeys.has(trashEntryKey("sent", m.id)),
    );
  }

  get enabledDrafts(): DraftEmail[] {
    const set = this.enabledSet;
    if (set.size === 0) return [];
    return this.drafts.filter((d) => {
      if (!d.from) return true;
      return set.has(d.from.toLowerCase());
    });
  }

  get visibleDrafts(): DraftEmail[] {
    if (this.accountFilter === "all") return this.enabledDrafts;
    const needle = this.accountFilter.toLowerCase();
    return this.enabledDrafts.filter(
      (d) => !d.from || d.from.toLowerCase() === needle,
    );
  }

  get trashedActivity(): RoutingActivityEvent[] {
    const trashKeys = this.trashKeys;
    return this.enabledActivity.filter((m) =>
      trashKeys.has(trashEntryKey("inbox", m.key)),
    );
  }

  get trashedSent(): SentEmail[] {
    const trashKeys = this.trashKeys;
    return this.enabledSent.filter((m) =>
      trashKeys.has(trashEntryKey("sent", m.id)),
    );
  }

  get inboxCount(): number {
    return this.visibleActivity.length;
  }

  get sentCount(): number {
    return this.visibleSent.length;
  }

  get trashCount(): number {
    return this.trashedActivity.length + this.trashedSent.length;
  }

  get readKeySet(): Set<string> {
    return new Set(this.readKeys);
  }

  get unreadCount(): number {
    if (!this.readStateReady) return 0;
    const read = this.readKeySet;
    return this.visibleActivity.filter((m) => !read.has(m.key)).length;
  }

  get relaybaseOk(): boolean {
    return this.config?.relaybaseConfigured ?? false;
  }

  isUnread(key: string): boolean {
    if (!this.readStateReady || !key) return false;
    return !this.readKeySet.has(key);
  }

  unreadCountForAccount(email: string): number {
    if (!this.readStateReady) return 0;
    const needle = email.trim().toLowerCase();
    if (!needle) return 0;
    const read = this.readKeySet;
    return this.visibleActivity.filter(
      (m) => inboundMatchesAccount(m, needle) && !read.has(m.key),
    ).length;
  }

  markRead(key: string) {
    const trimmed = key.trim();
    if (!trimmed || !this.productId) return;
    if (this.readKeys.includes(trimmed)) return;
    this.readKeys = [...this.readKeys, trimmed];
    this.readStateReady = true;
    writeReadKeys(this.productId, this.readKeys);
  }

  markReadMany(keys: string[]) {
    if (!this.productId || !keys.length) return;
    const read = new Set(this.readKeys);
    let changed = false;
    for (const key of keys) {
      const trimmed = key.trim();
      if (!trimmed || read.has(trimmed)) continue;
      read.add(trimmed);
      changed = true;
    }
    if (!changed) return;
    this.readKeys = [...read];
    this.readStateReady = true;
    writeReadKeys(this.productId, this.readKeys);
  }

  markUnread(key: string) {
    const trimmed = key.trim();
    if (!trimmed || !this.productId || !this.readStateReady) return;
    if (!this.readKeys.includes(trimmed)) return;
    this.readKeys = this.readKeys.filter((readKey) => readKey !== trimmed);
    writeReadKeys(this.productId, this.readKeys);
  }

  markUnreadMany(keys: string[]) {
    if (!this.productId || !this.readStateReady || !keys.length) return;
    const drop = new Set(
      keys.map((k) => k.trim()).filter(Boolean),
    );
    if (!drop.size) return;
    const next = this.readKeys.filter((k) => !drop.has(k));
    if (next.length === this.readKeys.length) return;
    this.readKeys = next;
    writeReadKeys(this.productId, this.readKeys);
  }

  isDetailLoading(key: string): boolean {
    return this.detailLoadingKeys.includes(key.trim());
  }

  moveInboxToTrashMany(ids: string[]) {
    const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
    if (!unique.length) return;
    for (const id of unique) {
      if (this.trash.some((entry) => entry.kind === "inbox" && entry.id === id)) {
        continue;
      }
      this.trash = [
        ...this.trash,
        { kind: "inbox", id, trashedAt: new Date().toISOString() },
      ];
    }
    writeTrash(this.productId, this.trash);
    toast("Moved to Trash", {
      id: TRASH_UNDO_TOAST_ID,
      duration: TRASH_UNDO_MS,
      action: {
        label: "Undo",
        onClick: () => {
          for (const id of unique) {
            this.restoreFromTrash("inbox", id, { silent: true });
          }
        },
      },
    });
  }

  configure(input: {
    productId: string;
    apiBase: string;
    enabledAccounts: string[];
    enabledAddresses: Address[];
    /** From MailAccountsStore — mailbox does not fetch addresses:all itself. */
    availableAddresses?: Address[];
  }) {
    const domains = new Set(
      input.enabledAddresses.map((a) => domainOf(a.email)).filter(Boolean),
    );
    const nextDomainsKey = [...domains].sort().join("\0");
    const productChanged = this.productId !== input.productId;
    const domainsChanged = this.domainsKey !== nextDomainsKey;
    const apiChanged = this.apiBase !== input.apiBase;

    this.productId = input.productId;
    this.apiBase = input.apiBase;
    this.enabledAccounts = input.enabledAccounts;
    this.enabledAddresses = input.enabledAddresses;
    if (input.availableAddresses) {
      this.addresses = input.availableAddresses;
    }
    this.domainsKey = nextDomainsKey;

    if (
      this.accountFilter !== "all" &&
      !input.enabledAccounts.some(
        (email) => email.toLowerCase() === this.accountFilter.toLowerCase(),
      )
    ) {
      this.accountFilter = "all";
    }

    if (productChanged) {
      this.activity = [];
      this.sent = [];
      this.drafts = [];
      this.activityDetailByKey = {};
      this.detailLoadingKey = null;
      this.detailLoadingKeys = [];
      this.detailGenerationByKey.clear();
      this.mailReady = false;
      this.readKeys = [];
      this.readStateReady = false;
      this.hydrateFromStale();
    } else if (domainsChanged && nextDomainsKey) {
      this.hydrateInboxSentFromStale();
    }

    if (productChanged || domainsChanged || apiChanged) {
      void this.bootstrap();
    }
  }

  /** Load ~/.relaybase/mail (or localStorage), then network only if empty. */
  async bootstrap() {
    if (!this.productId) return;
    const generation = ++this.bootstrapGeneration;
    await this.hydrateUiState();
    if (this.bootstrapGeneration !== generation) return;
    await this.loadPersistedMail();
    if (this.bootstrapGeneration !== generation) return;
    this.ensureReadBaseline();
    // Soft refresh: skips inbox/sent network when disk/memory already has mail.
    await this.refresh(false);
    if (this.bootstrapGeneration !== generation) return;
    this.ensureReadBaseline();
  }

  private async hydrateUiState() {
    if (!this.productId) return;
    const productId = this.productId;
    const [stored, trash] = await Promise.all([
      hydrateReadKeys(productId),
      hydrateTrash(productId),
    ]);
    if (this.productId !== productId) return;
    runInAction(() => {
      this.trash = trash;
      if (stored === null) {
        this.readKeys = [];
        this.readStateReady = false;
      } else {
        this.readKeys = stored;
        this.readStateReady = true;
      }
    });
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.bindEvents();
    this.startNotificationPolling();
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    this.stopNotificationPolling();
    this.unbindEvents();
  }

  setAccountFilter(value: EmailAccountFilter) {
    this.accountFilter = value;
  }

  setOpenAccounts(value: string[] | ((prev: string[]) => string[])) {
    this.openAccounts =
      typeof value === "function" ? value(this.openAccounts) : value;
  }

  setError(value: string | null) {
    this.error = value;
  }

  moveToTrash(kind: TrashKind, id: string) {
    if (this.trash.some((entry) => entry.kind === kind && entry.id === id)) {
      return;
    }
    this.trash = [
      ...this.trash,
      { kind, id, trashedAt: new Date().toISOString() },
    ];
    writeTrash(this.productId, this.trash);

    if (kind === "inbox") {
      toast("Moved to Trash", {
        id: TRASH_UNDO_TOAST_ID,
        duration: TRASH_UNDO_MS,
        action: {
          label: "Undo",
          onClick: () => {
            this.restoreFromTrash(kind, id, { silent: true });
          },
        },
      });
      return;
    }

    toast.success("Moved to Trash");
  }

  restoreFromTrash(
    kind: TrashKind,
    id: string,
    opts?: { silent?: boolean },
  ) {
    this.trash = this.trash.filter(
      (entry) => !(entry.kind === kind && entry.id === id),
    );
    writeTrash(this.productId, this.trash);
    if (!opts?.silent) {
      toast.success("Restored from Trash");
    }
  }

  emptyTrash() {
    this.trash = [];
    writeTrash(this.productId, []);
    toast.success("Trash emptied");
  }

  getDraft(id: string): DraftEmail | null {
    return this.drafts.find((d) => d.id === id) ?? null;
  }

  findDraftByReplyKey(replyKey: string): DraftEmail | null {
    const key = replyKey.trim();
    if (!key) return null;
    return this.drafts.find((d) => d.replyKey === key) ?? null;
  }

  /** Reply / forward drafts tied to any inbound key in the thread. */
  findDraftsForThread(inboundKeys: string[]): DraftEmail[] {
    const keys = new Set(
      inboundKeys.map((k) => k.trim()).filter(Boolean),
    );
    if (keys.size === 0) return [];
    return this.drafts
      .filter((d) => {
        const reply = d.replyKey?.trim();
        if (reply && keys.has(reply)) return true;
        const forward = d.forwardKey?.trim();
        if (forward && keys.has(forward)) return true;
        return false;
      })
      .slice()
      .sort((a, b) => {
        const aAt = Date.parse(a.updatedAt) || 0;
        const bAt = Date.parse(b.updatedAt) || 0;
        return aAt - bAt;
      });
  }

  upsertDraft(
    input: Omit<DraftEmail, "createdAt" | "updatedAt"> & {
      createdAt?: string;
      updatedAt?: string;
    },
  ): DraftEmail {
    const now = new Date().toISOString();
    const existing = this.drafts.find((d) => d.id === input.id);
    const draft: DraftEmail = {
      id: input.id,
      from: input.from,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      createdAt: existing?.createdAt ?? input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now,
      replyKey: input.replyKey,
      replyAll: input.replyAll,
      forwardKey: input.forwardKey,
    };
    if (existing) {
      this.drafts = this.drafts.map((d) => (d.id === draft.id ? draft : d));
    } else {
      this.drafts = [draft, ...this.drafts];
    }
    this.persistDrafts();
    return draft;
  }

  removeDraft(id: string) {
    const next = this.drafts.filter((d) => d.id !== id);
    if (next.length === this.drafts.length) return;
    this.drafts = next;
    this.persistDrafts();
  }

  getCachedDetail(messageId: string): RoutingActivityEvent | null {
    return this.activityDetailByKey[messageId] ?? null;
  }

  async loadMessageDetail(messageId: string, domain: string) {
    this.markRead(messageId);
    const cached = this.activityDetailByKey[messageId];
    if (cached?.bodyText || cached?.bodyHtml || cached?.attachments?.length) {
      runInAction(() => {
        this.detailLoadingKeys = this.detailLoadingKeys.filter(
          (k) => k !== messageId,
        );
        if (this.detailLoadingKey === messageId) {
          this.detailLoadingKey = null;
        }
      });
      return cached;
    }

    const generation = (this.detailGenerationByKey.get(messageId) ?? 0) + 1;
    this.detailGenerationByKey.set(messageId, generation);
    this.detailLoadingKey = messageId;
    if (!this.detailLoadingKeys.includes(messageId)) {
      this.detailLoadingKeys = [...this.detailLoadingKeys, messageId];
    }

    const clearLoading = () => {
      this.detailLoadingKeys = this.detailLoadingKeys.filter(
        (k) => k !== messageId,
      );
      if (this.detailLoadingKey === messageId) {
        this.detailLoadingKey = null;
      }
    };

    try {
      const fromDisk = await loadPersistedDetail(this.productId, messageId);
      if (
        fromDisk &&
        this.detailGenerationByKey.get(messageId) === generation
      ) {
        runInAction(() => {
          this.activityDetailByKey[messageId] = fromDisk;
          clearLoading();
        });
        return fromDisk;
      }

      const res = await fetch(
        `${this.apiBase}/inbox/${encodeURIComponent(messageId)}${inboxDetailQuery(domain)}`,
      );
      const data = (await res.json()) as RoutingActivityEvent & {
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      if (this.detailGenerationByKey.get(messageId) !== generation) return null;
      runInAction(() => {
        this.activityDetailByKey[messageId] = data;
        clearLoading();
      });
      void savePersistedDetail(this.productId, data);
      return data;
    } catch (e) {
      if (this.detailGenerationByKey.get(messageId) === generation) {
        runInAction(() => {
          clearLoading();
          this.error =
            e instanceof Error ? e.message : "Failed to load event";
        });
      }
      return null;
    }
  }

  async refresh(force = false) {
    if (!this.productId || !this.apiBase) return;

    const generation = ++this.refreshGeneration;
    const hasMail = this.activity.length > 0 || this.sent.length > 0 || this.mailReady;
    const skipMailNetwork = !force && hasMail;
    const hasData = this.config !== null || hasMail;
    if (!hasData) this.loading = true;
    this.refreshing = true;
    this.error = null;

    const domains = this.domainsKey ? this.domainsKey.split("\0") : [];

    try {
      const cfgResult = await fetchEmailCached<EmailConfig>(
        this.productId,
        "config",
        `${this.apiBase}/config`,
        {
          refresh: force,
          onUpdate: (data) => {
            if (this.refreshGeneration === generation) {
              runInAction(() => {
                this.config = data;
              });
            }
          },
        },
      );

      if (this.refreshGeneration !== generation) return;

      // Addresses come from MailAccountsStore via configure(); no addresses:all fetch.
      runInAction(() => {
        this.config = cfgResult.data;
      });

      if (skipMailNetwork) {
        return;
      }

      const inboxResults = await Promise.all(
        domains.map((domain) =>
          fetchEmailCachedOptional<{ messages?: RoutingActivityEvent[] }>(
            this.productId,
            `inbox:${domain}`,
            `${this.apiBase}/inbox${domainQuery(domain, { limit: "100" })}`,
            { refresh: force },
          ),
        ),
      );

      const sentResults = await Promise.all(
        domains.map((domain) =>
          fetchEmailCachedOptional<{ sent?: SentEmail[] }>(
            this.productId,
            `sent:${domain}`,
            `${this.apiBase}/sent${domainQuery(domain)}`,
            { refresh: force },
          ),
        ),
      );

      if (this.refreshGeneration !== generation) return;

      runInAction(() => {
        const mergedInbox: RoutingActivityEvent[] = [];
        let inboxFailed = false;
        for (const result of inboxResults) {
          if (!result.ok) {
            inboxFailed = true;
            continue;
          }
          mergedInbox.push(...(result.data?.messages ?? []));
        }
        const previousInbox = new Map(
          this.activity.map((msg) => [msg.key, msg] as const),
        );
        const inboxByKey = new Map<string, RoutingActivityEvent>();
        // Network is source of truth for membership; keep richer local bodies.
        for (const msg of mergedInbox) {
          const prev = previousInbox.get(msg.key);
          inboxByKey.set(
            msg.key,
            prev && (prev.bodyText || prev.bodyHtml || prev.attachments?.length)
              ? { ...prev, ...pickListFields(msg) }
              : msg,
          );
        }
        this.activity = [...inboxByKey.values()];
        if (inboxFailed && domains.length > 0) {
          this.error = "Failed to load received mail from Relaybase";
        }

        const previousSent = new Map(
          this.sent.map((msg) => [msg.id, msg] as const),
        );
        const sentById = new Map<string, SentEmail>();
        for (const result of sentResults) {
          if (!result.ok) continue;
          for (const msg of result.data?.sent ?? []) {
            sentById.set(msg.id, previousSent.get(msg.id) ?? msg);
          }
        }
        // Keep locally known sent mail when a force refresh races a just-written
        // record (remote KV can lag behind the send response).
        for (const [id, msg] of previousSent) {
          if (!sentById.has(id)) sentById.set(id, msg);
        }
        // Soft first-load: if every sent request failed, keep prior local mail.
        if (sentById.size > 0 || force || this.sent.length === 0) {
          this.sent = [...sentById.values()];
        }
        this.mailReady = true;
        this.ensureReadBaseline();
      });

      void this.persistMailLists();
    } catch (e) {
      if (this.refreshGeneration === generation) {
        runInAction(() => {
          this.error = e instanceof Error ? e.message : "Refresh failed";
        });
      }
    } finally {
      if (this.refreshGeneration === generation) {
        runInAction(() => {
          this.loading = false;
          this.refreshing = false;
        });
      }
    }
  }

  private async loadPersistedMail() {
    if (!this.productId) return;
    const [inbox, sent, drafts] = await Promise.all([
      loadPersistedInbox(this.productId),
      loadPersistedSent(this.productId),
      loadPersistedDrafts(this.productId),
    ]);
    runInAction(() => {
      if (inbox && inbox.length > 0) {
        const inboxByKey = new Map<string, RoutingActivityEvent>();
        for (const msg of this.activity) inboxByKey.set(msg.key, msg);
        for (const msg of inbox) inboxByKey.set(msg.key, msg);
        this.activity = [...inboxByKey.values()];
        this.mailReady = true;
        this.loading = false;
      }
      if (sent && sent.length > 0) {
        const sentById = new Map<string, SentEmail>();
        for (const msg of this.sent) sentById.set(msg.id, msg);
        for (const msg of sent) sentById.set(msg.id, msg);
        this.sent = [...sentById.values()];
        this.mailReady = true;
        this.loading = false;
      }
      if (drafts) {
        this.drafts = drafts;
        if (drafts.length > 0) {
          this.mailReady = true;
          this.loading = false;
        }
      }
    });
  }

  private persistMailLists() {
    if (!this.productId) return;
    void savePersistedInbox(this.productId, this.activity);
    void savePersistedSent(this.productId, this.sent);
  }

  private persistDrafts() {
    if (!this.productId) return;
    void savePersistedDrafts(this.productId, this.drafts);
  }

  /** First-run: treat currently loaded inbox as already seen. */
  private ensureReadBaseline() {
    if (this.readStateReady || !this.productId) return;
    if (this.activity.length === 0 && !this.mailReady) return;
    this.readKeys = this.activity.map((m) => m.key);
    this.readStateReady = true;
    writeReadKeys(this.productId, this.readKeys);
  }

  private hydrateFromStale() {
    if (!this.productId) return;
    const staleConfig = readEmailStale<EmailConfig>(this.productId, "config");
    if (staleConfig) {
      this.config = staleConfig;
      this.loading = false;
    }
    this.hydrateInboxSentFromStale();
  }

  private hydrateInboxSentFromStale() {
    if (!this.productId || !this.domainsKey) return;
    const domains = this.domainsKey.split("\0");
    const mergedInbox: RoutingActivityEvent[] = [];
    const mergedSent: SentEmail[] = [];

    for (const domain of domains) {
      const inbox = readEmailStale<{ messages?: RoutingActivityEvent[] }>(
        this.productId,
        `inbox:${domain}`,
      );
      if (inbox?.messages) mergedInbox.push(...inbox.messages);

      const sent = readEmailStale<{ sent?: SentEmail[] }>(
        this.productId,
        `sent:${domain}`,
      );
      if (sent?.sent) mergedSent.push(...sent.sent);
    }

    if (mergedInbox.length > 0) {
      const inboxByKey = new Map<string, RoutingActivityEvent>();
      for (const msg of mergedInbox) inboxByKey.set(msg.key, msg);
      this.activity = [...inboxByKey.values()];
      this.loading = false;
    }

    if (mergedSent.length > 0) {
      const sentById = new Map<string, SentEmail>();
      for (const msg of mergedSent) sentById.set(msg.id, msg);
      this.sent = [...sentById.values()];
      this.loading = false;
    }
  }

  private onUpdatesSynced = () => {
    for (const domain of this.domainsKey ? this.domainsKey.split("\0") : []) {
      clearEmailCache(this.productId, `inbox:${domain}`);
    }
    void this.refresh(true);
  };

  private onSendStarted = () => {
    this.error = null;
    toast.loading("Sending…", { id: SEND_TOAST_ID });
  };

  private onSendSucceeded = (event: Event) => {
    const detail = (event as CustomEvent<EmailSendSucceededDetail>).detail;
    const sent = detail?.sent;
    if (sent?.id) {
      const without = this.sent.filter((msg) => msg.id !== sent.id);
      this.sent = [sent, ...without];
      void this.persistMailLists();
    }
    this.error = null;
    toast.success("Email sent", { id: SEND_TOAST_ID });
    for (const domain of this.domainsKey ? this.domainsKey.split("\0") : []) {
      clearEmailCache(this.productId, `sent:${domain}`);
    }
    void this.refresh(true);
  };

  private onSendFailed = (event: Event) => {
    const detail = (event as CustomEvent<{ error?: string }>).detail;
    const error = detail?.error || "Send failed";
    toast.error(error, { id: SEND_TOAST_ID });
    this.error = null;
  };

  private onVisibilityOrFocus = () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") {
      return;
    }
    void this.pollInboxNotifications();
  };

  private startNotificationPolling() {
    if (typeof window === "undefined") return;
    this.stopNotificationPolling();
    void this.pollInboxNotifications();
    this.notificationPollTimer = setInterval(() => {
      void this.pollInboxNotifications();
    }, NOTIFICATION_POLL_MS);
    document.addEventListener("visibilitychange", this.onVisibilityOrFocus);
    window.addEventListener("focus", this.onVisibilityOrFocus);
  }

  private stopNotificationPolling() {
    if (this.notificationPollTimer) {
      clearInterval(this.notificationPollTimer);
      this.notificationPollTimer = null;
    }
    if (typeof window === "undefined") return;
    document.removeEventListener("visibilitychange", this.onVisibilityOrFocus);
    window.removeEventListener("focus", this.onVisibilityOrFocus);
  }

  async pollInboxNotifications() {
    if (
      !this.started ||
      !this.productId ||
      !this.apiBase ||
      this.notificationPollInFlight
    ) {
      return;
    }
    const domains = this.domainsKey ? this.domainsKey.split("\0").filter(Boolean) : [];
    if (domains.length === 0) return;

    this.notificationPollInFlight = true;
    try {
      const allEvents: InboxNotificationEvent[] = [];
      const eventsByDomain = new Map<string, string[]>();

      await Promise.all(
        domains.map(async (domain) => {
          try {
            const res = await fetch(
              `${this.apiBase}/inbox/notifications${domainQuery(domain, { limit: "25" })}`,
            );
            if (!res.ok) return;
            const data = (await res.json()) as {
              events?: InboxNotificationEvent[];
            };
            const events = data.events ?? [];
            if (events.length === 0) return;
            allEvents.push(...events);
            eventsByDomain.set(
              domain,
              events.map((event) => event.id),
            );
          } catch {
            // ignore transient poll errors
          }
        }),
      );

      if (allEvents.length === 0) return;

      const arrivalIds = allEvents
        .map((event) => event.data.messageId?.trim())
        .filter((id): id is string => Boolean(id));

      for (const domain of eventsByDomain.keys()) {
        clearEmailCache(this.productId, `inbox:${domain}`);
      }

      await this.refresh(true);
      // After refresh: baseline existing mail once, then keep arrivals unread.
      this.ensureReadBaseline();
      this.markUnreadMany(arrivalIds);

      void notifyNewMail(
        allEvents.map((event) => ({
          from: event.data.from,
          subject: event.data.subject,
        })),
      );

      await Promise.all(
        [...eventsByDomain.entries()].map(async ([domain, ids]) => {
          try {
            await fetch(`${this.apiBase}/inbox/notifications`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ domain, ids }),
            });
          } catch {
            // retry on next poll if ack fails
          }
        }),
      );
    } finally {
      this.notificationPollInFlight = false;
    }
  }

  private bindEvents() {
    if (this.bound || typeof window === "undefined") return;
    this.bound = true;
    window.addEventListener("ops-dashboard:updates-synced", this.onUpdatesSynced);
    window.addEventListener(EMAIL_SEND_STARTED, this.onSendStarted);
    window.addEventListener(EMAIL_SEND_SUCCEEDED, this.onSendSucceeded);
    window.addEventListener(EMAIL_SEND_FAILED, this.onSendFailed);
  }

  private unbindEvents() {
    if (!this.bound || typeof window === "undefined") return;
    this.bound = false;
    window.removeEventListener(
      "ops-dashboard:updates-synced",
      this.onUpdatesSynced,
    );
    window.removeEventListener(EMAIL_SEND_STARTED, this.onSendStarted);
    window.removeEventListener(EMAIL_SEND_SUCCEEDED, this.onSendSucceeded);
    window.removeEventListener(EMAIL_SEND_FAILED, this.onSendFailed);
  }
}

/** Prefer network list metadata while preserving locally cached body fields. */
function pickListFields(
  msg: RoutingActivityEvent,
): Pick<
  RoutingActivityEvent,
  | "fromEmail"
  | "toEmail"
  | "toEmails"
  | "ccEmails"
  | "subject"
  | "status"
  | "action"
  | "receivedAt"
  | "errorDetail"
  | "bodyPreview"
  | "attachmentCount"
  | "messageId"
  | "inReplyTo"
  | "references"
> {
  return {
    fromEmail: msg.fromEmail,
    toEmail: msg.toEmail,
    toEmails: msg.toEmails,
    ccEmails: msg.ccEmails,
    subject: msg.subject,
    status: msg.status,
    action: msg.action,
    receivedAt: msg.receivedAt,
    errorDetail: msg.errorDetail,
    bodyPreview: msg.bodyPreview,
    attachmentCount: msg.attachmentCount,
    messageId: msg.messageId,
    inReplyTo: msg.inReplyTo,
    references: msg.references,
  };
}
