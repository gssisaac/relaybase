"use client";

import { makeAutoObservable, runInAction } from "mobx";
import { toast } from "sonner";

import type { EmailAccountFilter } from "@/email/components/accounts/EmailAccountSelect";
import {
  clearEmailCache,
  fetchEmailCached,
  fetchEmailCachedOptional,
} from "@/email/components/mailbox/email-cached-fetch";
import {
  desktopAwareFetch,
  isPackagedApiUnavailableError,
  readResponseJson,
} from "@/lib/desktop/api-base";
import {
  EMAIL_SEND_FAILED,
  EMAIL_SEND_STARTED,
  EMAIL_SEND_SUCCEEDED,
  type EmailSendFailedDetail,
  type EmailSendSucceededDetail,
} from "@/email/components/compose/email-send-events";
import { notifyIfCloudflarePlanError } from "@/lib/cloudflare/CloudflarePlanDialog";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import type {
  Address,
  DraftEmail,
  EmailConfig,
  RoutingActivityEvent,
  SentEmail,
} from "@/email/components/mailbox/types";
import {
  loadPersistedDetail,
  loadPersistedDrafts,
  loadPersistedInbox,
  loadPersistedSent,
  savePersistedDetail,
  savePersistedDrafts,
  savePersistedInbox,
  savePersistedSent,
} from "@/email/lib/disk/email-disk-store";
import {
  hydrateReadState,
  writeReadOverrides,
  type ReadOverrides,
} from "@/email/lib/read/read-store";
import {
  hydrateTrash,
  trashEntryKey,
  writeTrash,
  type TrashEntry,
  type TrashKind,
} from "@/email/lib/trash/trash-store";
import { inboundMatchesAccount } from "@/email/lib/threading/conversation-threading";
import { notifyNewMail } from "@/lib/desktop/notify";

const INBOX_PAGE_SIZE = 50;
const SENT_PAGE_SIZE = 50;
const SEARCH_PAGE_SIZE = 50;
/** Server-side search kicks in from this query length (matches Worker). */
export const MIN_SERVER_SEARCH_LENGTH = 2;
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

  /**
   * Local read/unread overrides, keyed by message key. Truth lives on the
   * Worker (`RoutingActivityEvent.readAt`) — this is only an optimistic
   * cache for in-flight/offline mark-read/unread requests. See
   * docs/inbox-threading-and-multi-account.md.
   */
  readOverrides: ReadOverrides = {};
  /** Legacy local `{ keys }` read state, reconciled once against the server. */
  private pendingLegacyReadKeys: string[] | null = null;

  productId = "";
  apiBase = "";
  /** Account scope id — when this changes (CF/Relaybase account switch),
   * the store resets all in-memory mail state and re-bootstraps from the
   * new scope's disk cache. Disk paths are scoped by Rust; this field is for
   * in-memory change detection only. */
  scopeId = "";
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
  inboxNextBeforeByDomain: Record<string, string | null> = {};
  inboxHasMoreByDomain: Record<string, boolean> = {};
  inboxLoadingMore = false;
  /** Whole-mailbox totals from the Worker list responses (per domain). */
  inboxTotalByDomain: Record<string, number> = {};
  inboxUnreadByDomain: Record<string, number> = {};
  /** Per-address total/unread from `/inbox/counts` (account-filter header). */
  inboxCountsByAddress: Record<string, { total: number; unread: number }> = {};
  sentNextBeforeByDomain: Record<string, string | null> = {};
  sentHasMoreByDomain: Record<string, boolean> = {};
  sentTotalByDomain: Record<string, number> = {};
  sentLoadingMore = false;

  /** Server-side search (D1 `mailbox_fts` for inbox and sent). */
  searchQuery = "";
  searchFolder: "inbox" | "sent" | null = null;
  searchInboxResults: RoutingActivityEvent[] = [];
  searchSentResults: SentEmail[] = [];
  searchTotal = 0;
  searchLoading = false;
  searchLoadingMore = false;
  /** True when the Worker has no search index (fall back to local filter). */
  searchUnavailable = false;
  searchNextBeforeByDomain: Record<string, string | null> = {};
  searchHasMoreByDomain: Record<string, boolean> = {};
  private searchGeneration = 0;

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

  /** Derived — messages currently considered read (compat with older callers). */
  get readKeys(): string[] {
    return this.visibleActivity
      .filter((m) => this.isReadEffective(m))
      .map((m) => m.key);
  }

  get unreadCount(): number {
    return this.visibleActivity.filter((m) => !this.isReadEffective(m)).length;
  }

  get relaybaseOk(): boolean {
    return this.config?.relaybaseConfigured ?? false;
  }

  get inboxHasMore(): boolean {
    const domains = this.domainsKey ? this.domainsKey.split("\0").filter(Boolean) : [];
    if (domains.length === 0) return false;
    return domains.some((domain) => this.inboxHasMoreByDomain[domain] !== false);
  }

  get sentHasMore(): boolean {
    const domains = this.domainsKey ? this.domainsKey.split("\0").filter(Boolean) : [];
    if (domains.length === 0) return false;
    return domains.some((domain) => this.sentHasMoreByDomain[domain] === true);
  }

  private get enabledDomains(): string[] {
    return this.domainsKey ? this.domainsKey.split("\0").filter(Boolean) : [];
  }

  /** Whole-mailbox inbox total across enabled domains, or null before first fetch. */
  get inboxTotal(): number | null {
    return sumByDomain(this.enabledDomains, this.inboxTotalByDomain);
  }

  /** Whole-mailbox unread total across enabled domains, or null before first fetch. */
  get inboxUnreadTotal(): number | null {
    return sumByDomain(this.enabledDomains, this.inboxUnreadByDomain);
  }

  /** Whole-mailbox sent total across enabled domains, or null before first fetch. */
  get sentTotal(): number | null {
    return sumByDomain(this.enabledDomains, this.sentTotalByDomain);
  }

  /** Whole-mailbox totals for a single address (server counts), or null. */
  inboxCountsForAccount(
    email: string,
  ): { total: number; unread: number } | null {
    return this.inboxCountsByAddress[email.trim().toLowerCase()] ?? null;
  }

  /** True when list views should render server search results for `folder`. */
  searchActiveFor(folder: string, query: string): boolean {
    return (
      !this.searchUnavailable &&
      this.searchFolder === folder &&
      this.searchQuery.length >= MIN_SERVER_SEARCH_LENGTH &&
      query.trim().length >= MIN_SERVER_SEARCH_LENGTH
    );
  }

  get searchHasMore(): boolean {
    return Object.values(this.searchHasMoreByDomain).some(Boolean);
  }

  private inboxCursorsReady(): boolean {
    const domains = this.domainsKey ? this.domainsKey.split("\0").filter(Boolean) : [];
    if (domains.length === 0) return true;
    return domains.every((domain) => domain in this.inboxHasMoreByDomain);
  }

  /**
   * Override (if pending) else the message's server `readAt`.
   * Match Worker `normalizeReadState`: explicit `null` = unread (new mail);
   * missing/`undefined` = pre-migration backlog = already read.
   */
  private isReadEffective(
    message: Pick<RoutingActivityEvent, "key" | "readAt">,
  ): boolean {
    const override = this.readOverrides[message.key];
    if (override !== undefined) return override;
    if (!("readAt" in message) || message.readAt === undefined) return true;
    return Boolean(message.readAt);
  }

  private findMessage(key: string): RoutingActivityEvent | null {
    return (
      this.activity.find((m) => m.key === key) ??
      this.activityDetailByKey[key] ??
      this.searchInboxResults.find((m) => m.key === key) ??
      null
    );
  }

  isUnread(key: string): boolean {
    const trimmed = key.trim();
    if (!trimmed) return false;
    const message = this.findMessage(trimmed);
    if (message) return !this.isReadEffective(message);
    const override = this.readOverrides[trimmed];
    return override === undefined ? false : !override;
  }

  unreadCountForAccount(email: string): number {
    const needle = email.trim().toLowerCase();
    if (!needle) return 0;
    return this.visibleActivity.filter(
      (m) => inboundMatchesAccount(m, needle) && !this.isReadEffective(m),
    ).length;
  }

  private applyReadOverrides(keys: string[], read: boolean) {
    if (!keys.length || !this.productId) return;
    const next = { ...this.readOverrides };
    for (const key of keys) next[key] = read;
    this.readOverrides = next;
    writeReadOverrides(this.productId, this.readOverrides);
  }

  private resolveDomainForKey(key: string): string | null {
    const message = this.findMessage(key);
    if (!message) return null;
    return domainOf(message.toEmail) || null;
  }

  /** POST the new read state to the Worker, grouped by domain. */
  private async syncReadState(keys: string[], read: boolean) {
    if (!this.productId || !this.apiBase || !keys.length) return;
    const byDomain = new Map<string, string[]>();
    for (const key of keys) {
      const domain = this.resolveDomainForKey(key);
      if (!domain) continue;
      const list = byDomain.get(domain) ?? [];
      list.push(key);
      byDomain.set(domain, list);
    }

    await Promise.all(
      [...byDomain.entries()].map(async ([domain, ids]) => {
        try {
          const res = await desktopAwareFetch(`${this.apiBase}/inbox/read`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain, ids, read }),
          });
          if (!res.ok) {
            const data = await readResponseJson<{ error?: string }>(res).catch(
              () => ({}),
            );
            throw new Error(
              (data as { error?: string }).error ?? "Failed to sync read state",
            );
          }
        } catch (e) {
          // Keep the optimistic override; it stays persisted locally and
          // will be retried the next time this key is marked, and
          // reconciled against the server on the next inbox refresh.
          console.error("[relaybase] failed to sync read state", e);
        }
      }),
    );
  }

  /** Drop overrides once a fresh network fetch confirms the same state. */
  private pruneConfirmedOverrides() {
    const keys = Object.keys(this.readOverrides);
    if (!keys.length) return;
    const byKey = new Map(this.activity.map((m) => [m.key, m] as const));
    const next = { ...this.readOverrides };
    let changed = false;
    for (const key of keys) {
      const message = byKey.get(key);
      if (!message) continue;
      if (Boolean(message.readAt) === this.readOverrides[key]) {
        delete next[key];
        changed = true;
      }
    }
    if (changed) {
      this.readOverrides = next;
      writeReadOverrides(this.productId, this.readOverrides);
    }
  }

  markRead(key: string) {
    const trimmed = key.trim();
    if (!trimmed || !this.productId || !this.isUnread(trimmed)) return;
    this.applyReadOverrides([trimmed], true);
    void this.syncReadState([trimmed], true);
  }

  markReadMany(keys: string[]) {
    if (!this.productId || !keys.length) return;
    const targets = [
      ...new Set(keys.map((k) => k.trim()).filter(Boolean)),
    ].filter((key) => this.isUnread(key));
    if (!targets.length) return;
    this.applyReadOverrides(targets, true);
    void this.syncReadState(targets, true);
  }

  markUnread(key: string) {
    const trimmed = key.trim();
    if (!trimmed || !this.productId || this.isUnread(trimmed)) return;
    this.applyReadOverrides([trimmed], false);
    void this.syncReadState([trimmed], false);
  }

  markUnreadMany(keys: string[]) {
    if (!this.productId || !keys.length) return;
    const targets = [
      ...new Set(keys.map((k) => k.trim()).filter(Boolean)),
    ].filter((key) => !this.isUnread(key));
    if (!targets.length) return;
    this.applyReadOverrides(targets, false);
    void this.syncReadState(targets, false);
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
    scopeId?: string;
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
    const nextScopeId = input.scopeId ?? "";
    const scopeChanged = this.scopeId !== nextScopeId && nextScopeId !== "";
    const resetNeeded = productChanged || scopeChanged;
    const domainsChanged = this.domainsKey !== nextDomainsKey;
    const apiChanged = this.apiBase !== input.apiBase;

    this.productId = input.productId;
    this.apiBase = input.apiBase;
    if (nextScopeId) this.scopeId = nextScopeId;
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

    if (resetNeeded) {
      this.activity = [];
      this.sent = [];
      this.drafts = [];
      this.activityDetailByKey = {};
      this.detailLoadingKey = null;
      this.detailLoadingKeys = [];
      this.detailGenerationByKey.clear();
      this.mailReady = false;
      this.readOverrides = {};
      this.pendingLegacyReadKeys = null;
      this.inboxNextBeforeByDomain = {};
      this.inboxHasMoreByDomain = {};
      this.inboxLoadingMore = false;
      this.inboxTotalByDomain = {};
      this.inboxUnreadByDomain = {};
      this.inboxCountsByAddress = {};
      this.sentNextBeforeByDomain = {};
      this.sentHasMoreByDomain = {};
      this.sentTotalByDomain = {};
      this.sentLoadingMore = false;
      this.clearSearch();
      this.hydrateFromStale();
    } else if (domainsChanged && nextDomainsKey) {
      this.hydrateInboxSentFromStale();
    }

    if (resetNeeded || domainsChanged || apiChanged) {
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
    await this.refresh(false);
    if (this.bootstrapGeneration !== generation) return;
    await this.reconcileLegacyReadState();
  }

  private async hydrateUiState() {
    if (!this.productId) return;
    const productId = this.productId;
    const [stored, trash] = await Promise.all([
      hydrateReadState(productId),
      hydrateTrash(productId),
    ]);
    if (this.productId !== productId) return;
    runInAction(() => {
      this.trash = trash;
      this.readOverrides = stored?.overrides ?? {};
    });
    this.pendingLegacyReadKeys = stored?.legacyReadKeys ?? null;
  }

  /**
   * One-time reconciliation for installs upgrading from local-only read
   * state: the server's `normalizeReadState` fallback treats pre-migration
   * backlog as already read, which could silently flip mail the user had
   * genuinely never opened. Compare the legacy local `{ keys }` list against
   * the freshly-fetched server `readAt` values and correct any mismatch
   * exactly once.
   */
  private async reconcileLegacyReadState() {
    const legacyKeys = this.pendingLegacyReadKeys;
    this.pendingLegacyReadKeys = null;
    if (!legacyKeys || !this.productId) return;

    const legacySet = new Set(legacyKeys);
    const toMarkUnread: string[] = [];
    const toMarkRead: string[] = [];
    for (const message of this.activity) {
      const wasReadLocally = legacySet.has(message.key);
      // Same semantics as isReadEffective (without overrides).
      const serverRead =
        !("readAt" in message) ||
        message.readAt === undefined ||
        Boolean(message.readAt);
      if (!wasReadLocally && serverRead) {
        toMarkUnread.push(message.key);
      } else if (wasReadLocally && !serverRead) {
        toMarkRead.push(message.key);
      }
    }
    if (toMarkUnread.length) this.markUnreadMany(toMarkUnread);
    if (toMarkRead.length) this.markReadMany(toMarkRead);

    // Persist the v2 shape (drops the legacy `keys` file) so this only runs
    // once, even if there was nothing to reconcile.
    writeReadOverrides(this.productId, this.readOverrides);
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

  /**
   * Most recently updated draft for keyboard/command resume.
   * - reply / replyAll / forward: match mode + inbound key (usually latest)
   * - compose: standalone drafts (no replyKey / forwardKey)
   * UI per-message Reply/Forward must not use this — always new draft.
   */
  findResumableComposeDraft(
    mode: "reply" | "replyAll" | "forward" | "compose",
    inboundKey = "",
  ): DraftEmail | null {
    const matches =
      mode === "compose"
        ? this.drafts.filter(
            (d) => !d.replyKey?.trim() && !d.forwardKey?.trim(),
          )
        : (() => {
            const key = inboundKey.trim();
            if (!key) return [];
            return this.drafts.filter((d) => {
              if (mode === "forward") return d.forwardKey?.trim() === key;
              if (d.replyKey?.trim() !== key) return false;
              if (mode === "replyAll") return Boolean(d.replyAll);
              return !d.replyAll;
            });
          })();
    if (matches.length === 0) return null;
    // drafts list keeps most-recently upserted first; on equal timestamps keep it.
    let best = matches[0]!;
    let bestAt = Date.parse(best.updatedAt) || 0;
    for (let i = 1; i < matches.length; i++) {
      const draft = matches[i]!;
      const at = Date.parse(draft.updatedAt) || 0;
      if (at > bestAt) {
        best = draft;
        bestAt = at;
      }
    }
    return best;
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
    // Most-recently upserted first so resume ties break toward "just edited".
    this.drafts = [
      draft,
      ...this.drafts.filter((d) => d.id !== draft.id),
    ];
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
        (fromDisk.bodyText ||
          fromDisk.bodyHtml ||
          fromDisk.attachments?.length) &&
        this.detailGenerationByKey.get(messageId) === generation
      ) {
        runInAction(() => {
          this.activityDetailByKey[messageId] = fromDisk;
          clearLoading();
        });
        return fromDisk;
      }

      const res = await desktopAwareFetch(
        `${this.apiBase}/inbox/${encodeURIComponent(messageId)}${inboxDetailQuery(domain)}`,
      );
      const data = await readResponseJson<
        { message: RoutingActivityEvent; error?: string }
      >(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to load");
      const message = data.message;
      if (!message) throw new Error("Failed to load");
      if (this.detailGenerationByKey.get(messageId) !== generation) return null;
      runInAction(() => {
        this.activityDetailByKey[messageId] = message;
        clearLoading();
      });
      void savePersistedDetail(this.productId, message);
      return message;
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
    // Disk cache from before server-side readAt may omit the field — force a
    // network pull so UI unread matches Worker / dashboard counts.
    const needsReadAtHydrate = this.activity.some(
      (m) => !("readAt" in m) || m.readAt === undefined,
    );
    const skipMailNetwork =
      !force && hasMail && !needsReadAtHydrate && this.inboxCursorsReady();
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

      // Whole-mailbox + per-address counts refresh even when the mail lists
      // themselves are served from cache. Cheap on the Worker (compact
      // index aggregate) — best-effort.
      void this.refreshInboxCounts(domains, generation);

      if (skipMailNetwork) {
        return;
      }

      const inboxResults = await Promise.all(
        domains.map(async (domain) => {
          const page = await this.fetchInboxPage(domain, {
            limit: INBOX_PAGE_SIZE,
          });
          return { domain, page };
        }),
      );

      const sentResults = await Promise.all(
        domains.map(async (domain) => {
          const result = await fetchEmailCachedOptional<{
            sent?: SentEmail[];
            nextBefore?: string | null;
            hasMore?: boolean;
            total?: number;
          }>(
            this.productId,
            `sent:${domain}`,
            `${this.apiBase}/sent${domainQuery(domain, { limit: String(SENT_PAGE_SIZE) })}`,
            { refresh: force },
          );
          return { domain, result };
        }),
      );

      if (this.refreshGeneration !== generation) return;

      runInAction(() => {
        const mergedInbox: RoutingActivityEvent[] = [];
        let inboxFailed = false;
        const nextBefore = { ...this.inboxNextBeforeByDomain };
        const hasMore = { ...this.inboxHasMoreByDomain };
        const inboxTotals = { ...this.inboxTotalByDomain };
        const inboxUnreads = { ...this.inboxUnreadByDomain };
        for (const result of inboxResults) {
          if (!result.page) {
            inboxFailed = true;
            continue;
          }
          mergedInbox.push(...result.page.messages);
          if (!(result.domain in hasMore)) {
            nextBefore[result.domain] = result.page.nextBefore;
            hasMore[result.domain] = result.page.hasMore;
          }
          if (result.page.total != null) {
            inboxTotals[result.domain] = result.page.total;
          }
          if (result.page.unread != null) {
            inboxUnreads[result.domain] = result.page.unread;
          }
        }
        const inboxByKey = new Map(
          this.activity.map((msg) => [msg.key, msg] as const),
        );
        for (const msg of mergedInbox) {
          const prev = inboxByKey.get(msg.key);
          inboxByKey.set(
            msg.key,
            prev && (prev.bodyText || prev.bodyHtml || prev.attachments?.length)
              ? { ...prev, ...pickListFields(msg) }
              : msg,
          );
        }
        this.activity = [...inboxByKey.values()].sort((a, b) =>
          b.receivedAt.localeCompare(a.receivedAt),
        );
        this.inboxNextBeforeByDomain = nextBefore;
        this.inboxHasMoreByDomain = hasMore;
        this.inboxTotalByDomain = inboxTotals;
        this.inboxUnreadByDomain = inboxUnreads;
        if (inboxFailed && domains.length > 0) {
          this.error = "Failed to load received mail from Relaybase";
        }

        const previousSent = new Map(
          this.sent.map((msg) => [msg.id, msg] as const),
        );
        const sentById = new Map<string, SentEmail>();
        const sentNextBefore = { ...this.sentNextBeforeByDomain };
        const sentHasMore = { ...this.sentHasMoreByDomain };
        const sentTotals = { ...this.sentTotalByDomain };
        for (const { domain, result } of sentResults) {
          if (!result.ok) continue;
          for (const msg of result.data?.sent ?? []) {
            sentById.set(msg.id, previousSent.get(msg.id) ?? msg);
          }
          if (!(domain in sentHasMore)) {
            sentNextBefore[domain] = result.data?.nextBefore ?? null;
            sentHasMore[domain] = Boolean(result.data?.hasMore);
          }
          if (typeof result.data?.total === "number") {
            sentTotals[domain] = result.data.total;
          }
        }
        this.sentNextBeforeByDomain = sentNextBefore;
        this.sentHasMoreByDomain = sentHasMore;
        this.sentTotalByDomain = sentTotals;
        // Keep locally known sent mail when a force refresh races a just-written
        // record (remote KV can lag behind the send response).
        for (const [id, msg] of previousSent) {
          if (!sentById.has(id)) sentById.set(id, msg);
        }
        // Soft first-load: if every sent request failed, keep prior local mail.
        if (sentById.size > 0 || force || this.sent.length === 0) {
          this.sent = [...sentById.values()];
        }
        for (const domain of domains) {
          reconcileSentHasMoreForDomain(
            this.sent,
            domain,
            this.sentHasMoreByDomain,
            this.sentTotalByDomain,
          );
        }
        this.mailReady = true;
        this.pruneConfirmedOverrides();
      });

      void this.persistMailLists();
    } catch (e) {
      if (this.refreshGeneration === generation) {
        runInAction(() => {
          // Packaged features not yet wired (audience/stats/etc.) should not
          // paint the red Live API banner over cached mail.
          this.error = isPackagedApiUnavailableError(e)
            ? null
            : e instanceof Error
              ? e.message
              : "Refresh failed";
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

  private async fetchInboxPage(
    domain: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<{
    messages: RoutingActivityEvent[];
    nextBefore: string | null;
    hasMore: boolean;
    total: number | null;
    unread: number | null;
  } | null> {
    const extra: Record<string, string> = {
      limit: String(options.limit ?? INBOX_PAGE_SIZE),
    };
    if (options.before) extra.before = options.before;
    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/inbox${domainQuery(domain, extra)}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      const data = await readResponseJson<{
        messages?: RoutingActivityEvent[];
        nextBefore?: string | null;
        hasMore?: boolean;
        total?: number;
        unread?: number;
        error?: string;
      }>(res);
      if (!res.ok) return null;
      return {
        messages: data.messages ?? [],
        nextBefore: data.nextBefore ?? null,
        hasMore: Boolean(data.hasMore),
        total: typeof data.total === "number" ? data.total : null,
        unread: typeof data.unread === "number" ? data.unread : null,
      };
    } catch {
      return null;
    }
  }

  async loadMoreInbox() {
    if (
      !this.productId ||
      !this.apiBase ||
      this.inboxLoadingMore ||
      !this.inboxHasMore
    ) {
      return;
    }
    const domains = this.domainsKey
      ? this.domainsKey.split("\0").filter(Boolean)
      : [];
    if (domains.length === 0) return;

    this.inboxLoadingMore = true;
    try {
      const results = await Promise.all(
        domains.map(async (domain) => {
          if (this.inboxHasMoreByDomain[domain] === false) return null;
          const before =
            this.inboxNextBeforeByDomain[domain] ||
            oldestInboxCursor(this.activity, domain);
          if (!before) return null;
          const page = await this.fetchInboxPage(domain, {
            limit: INBOX_PAGE_SIZE,
            before,
          });
          return page ? { domain, page } : null;
        }),
      );

      runInAction(() => {
        const inboxByKey = new Map(
          this.activity.map((msg) => [msg.key, msg] as const),
        );
        const nextBefore = { ...this.inboxNextBeforeByDomain };
        const hasMore = { ...this.inboxHasMoreByDomain };
        for (const result of results) {
          if (!result) continue;
          for (const msg of result.page.messages) {
            const prev = inboxByKey.get(msg.key);
            inboxByKey.set(
              msg.key,
              prev &&
                (prev.bodyText || prev.bodyHtml || prev.attachments?.length)
                ? { ...prev, ...pickListFields(msg) }
                : msg,
            );
          }
          nextBefore[result.domain] = result.page.nextBefore;
          hasMore[result.domain] = result.page.hasMore;
        }
        this.activity = [...inboxByKey.values()].sort((a, b) =>
          b.receivedAt.localeCompare(a.receivedAt),
        );
        this.inboxNextBeforeByDomain = nextBefore;
        this.inboxHasMoreByDomain = hasMore;
      });
      void this.persistMailLists();
    } finally {
      runInAction(() => {
        this.inboxLoadingMore = false;
      });
    }
  }

  /**
   * Best-effort whole-mailbox counts from `/inbox/counts` — per-address
   * (account-filtered header) plus per-domain totals (all-accounts header).
   */
  private async refreshInboxCounts(domains: string[], generation: number) {
    if (!this.apiBase || domains.length === 0) return;
    const merged: Record<string, { total: number; unread: number }> = {};
    const totals: Record<string, number> = {};
    const unreads: Record<string, number> = {};
    await Promise.all(
      domains.map(async (domain) => {
        try {
          const res = await desktopAwareFetch(
            `${this.apiBase}/inbox/counts${domainQuery(domain)}`,
          );
          if (!res.ok) return;
          const data = await readResponseJson<{
            counts?: Record<string, { total: number; unread: number }>;
            totalAll?: number;
            unreadAll?: number;
          }>(res);
          for (const [email, value] of Object.entries(data.counts ?? {})) {
            merged[email.toLowerCase()] = value;
          }
          if (typeof data.totalAll === "number") totals[domain] = data.totalAll;
          if (typeof data.unreadAll === "number") {
            unreads[domain] = data.unreadAll;
          }
        } catch {
          // keep previous counts
        }
      }),
    );
    if (this.refreshGeneration !== generation) return;
    if (
      Object.keys(merged).length === 0 &&
      Object.keys(totals).length === 0
    ) {
      return;
    }
    runInAction(() => {
      this.inboxCountsByAddress = {
        ...this.inboxCountsByAddress,
        ...merged,
      };
      this.inboxTotalByDomain = { ...this.inboxTotalByDomain, ...totals };
      this.inboxUnreadByDomain = { ...this.inboxUnreadByDomain, ...unreads };
    });
  }

  private async fetchSentPage(
    domain: string,
    options: { limit?: number; before?: string; q?: string } = {},
  ): Promise<{
    sent: SentEmail[];
    nextBefore: string | null;
    hasMore: boolean;
    total: number | null;
  } | null> {
    const extra: Record<string, string> = {
      limit: String(options.limit ?? SENT_PAGE_SIZE),
    };
    if (options.before) extra.before = options.before;
    if (options.q) extra.q = options.q;
    try {
      const res = await desktopAwareFetch(
        `${this.apiBase}/sent${domainQuery(domain, extra)}`,
      );
      if (!res.ok) return null;
      const data = await readResponseJson<{
        sent?: SentEmail[];
        nextBefore?: string | null;
        hasMore?: boolean;
        total?: number;
      }>(res);
      return {
        sent: data.sent ?? [],
        nextBefore: data.nextBefore ?? null,
        hasMore: Boolean(data.hasMore),
        total: typeof data.total === "number" ? data.total : null,
      };
    } catch {
      return null;
    }
  }

  async loadMoreSent() {
    if (
      !this.productId ||
      !this.apiBase ||
      this.sentLoadingMore ||
      !this.sentHasMore
    ) {
      return;
    }
    const domains = this.domainsKey
      ? this.domainsKey.split("\0").filter(Boolean)
      : [];
    if (domains.length === 0) return;

    this.sentLoadingMore = true;
    try {
      const results = await Promise.all(
        domains.map(async (domain) => {
          if (this.sentHasMoreByDomain[domain] !== true) return null;
          const before =
            this.sentNextBeforeByDomain[domain] ||
            oldestSentCursor(this.sent, domain);
          if (!before) {
            return { domain, page: null };
          }
          const page = await this.fetchSentPage(domain, {
            limit: SENT_PAGE_SIZE,
            before,
          });
          return page ? { domain, page } : null;
        }),
      );

      runInAction(() => {
        const sentById = new Map(this.sent.map((msg) => [msg.id, msg] as const));
        const nextBefore = { ...this.sentNextBeforeByDomain };
        const hasMore = { ...this.sentHasMoreByDomain };
        const totals = { ...this.sentTotalByDomain };
        for (const result of results) {
          if (!result) continue;
          if (result.page === null) {
            hasMore[result.domain] = false;
            continue;
          }
          for (const msg of result.page.sent) {
            if (!sentById.has(msg.id)) sentById.set(msg.id, msg);
          }
          nextBefore[result.domain] = result.page.nextBefore;
          hasMore[result.domain] =
            result.page.sent.length > 0 && result.page.hasMore;
          if (result.page.total != null) {
            totals[result.domain] = result.page.total;
          }
        }
        this.sent = [...sentById.values()];
        for (const domain of domains) {
          reconcileSentHasMoreForDomain(this.sent, domain, hasMore, totals);
        }
        this.sentNextBeforeByDomain = nextBefore;
        this.sentHasMoreByDomain = hasMore;
        this.sentTotalByDomain = totals;
      });
      void this.persistMailLists();
    } finally {
      runInAction(() => {
        this.sentLoadingMore = false;
      });
    }
  }

  /**
   * Server-side search. Inbox and sent both query the Worker's D1
   * `mailbox_fts` index. Results are flat (no thread grouping). Falls back
   * to local filtering when the index is missing.
   */
  async searchMail(folder: "inbox" | "sent", query: string) {
    const q = query.trim();
    if (!this.productId || !this.apiBase) return;
    if (q.length < MIN_SERVER_SEARCH_LENGTH) {
      this.clearSearch();
      return;
    }
    const domains = this.domainsKey
      ? this.domainsKey.split("\0").filter(Boolean)
      : [];
    if (domains.length === 0) return;

    const generation = ++this.searchGeneration;
    runInAction(() => {
      this.searchFolder = folder;
      this.searchQuery = q;
      this.searchLoading = true;
    });

    let unavailable = false;
    let anyOk = false;
    const inboxMerged: RoutingActivityEvent[] = [];
    const sentMerged: SentEmail[] = [];
    let total = 0;
    const nextBefore: Record<string, string | null> = {};
    const hasMore: Record<string, boolean> = {};

    await Promise.all(
      domains.map(async (domain) => {
        try {
          if (folder === "inbox") {
            const res = await desktopAwareFetch(
              `${this.apiBase}/inbox/search${domainQuery(domain, {
                q,
                limit: String(SEARCH_PAGE_SIZE),
              })}`,
            );
            if (res.status === 503) {
              unavailable = true;
              return;
            }
            if (!res.ok) return;
            const data = await readResponseJson<{
              messages?: RoutingActivityEvent[];
              total?: number;
              nextBefore?: string | null;
              hasMore?: boolean;
            }>(res);
            anyOk = true;
            inboxMerged.push(...(data.messages ?? []));
            total += data.total ?? 0;
            nextBefore[domain] = data.nextBefore ?? null;
            hasMore[domain] = Boolean(data.hasMore);
            return;
          }
          const page = await this.fetchSentPage(domain, {
            limit: SEARCH_PAGE_SIZE,
            q,
          });
          if (!page) return;
          anyOk = true;
          sentMerged.push(...page.sent);
          total += page.total ?? page.sent.length;
          nextBefore[domain] = page.nextBefore;
          hasMore[domain] = page.hasMore;
        } catch {
          // per-domain search failure — fall through
        }
      }),
    );

    if (this.searchGeneration !== generation) return;
    runInAction(() => {
      if (unavailable || !anyOk) {
        // No usable server results — local filtering takes over.
        this.searchUnavailable = true;
        this.searchLoading = false;
        return;
      }
      this.searchUnavailable = false;
      this.searchInboxResults = inboxMerged.sort((a, b) =>
        b.receivedAt.localeCompare(a.receivedAt),
      );
      this.searchSentResults = sentMerged.sort((a, b) =>
        b.sentAt.localeCompare(a.sentAt),
      );
      this.searchTotal = total;
      this.searchNextBeforeByDomain = nextBefore;
      this.searchHasMoreByDomain = hasMore;
      this.searchLoading = false;
    });
  }

  async loadMoreSearch() {
    if (
      !this.searchFolder ||
      this.searchLoading ||
      this.searchLoadingMore ||
      this.searchUnavailable ||
      !this.searchHasMore
    ) {
      return;
    }
    const folder = this.searchFolder;
    const q = this.searchQuery;
    const generation = this.searchGeneration;
    const domains = Object.entries(this.searchHasMoreByDomain)
      .filter(([, more]) => more)
      .map(([domain]) => domain);
    if (domains.length === 0) return;

    this.searchLoadingMore = true;
    try {
      const results = await Promise.all(
        domains.map(async (domain) => {
          const before = this.searchNextBeforeByDomain[domain];
          if (!before) return null;
          try {
            if (folder === "inbox") {
              const res = await desktopAwareFetch(
                `${this.apiBase}/inbox/search${domainQuery(domain, {
                  q,
                  limit: String(SEARCH_PAGE_SIZE),
                  before,
                })}`,
              );
              if (!res.ok) return null;
              const data = await readResponseJson<{
                messages?: RoutingActivityEvent[];
                nextBefore?: string | null;
                hasMore?: boolean;
              }>(res);
              return {
                domain,
                inbox: data.messages ?? [],
                sent: [] as SentEmail[],
                nextBefore: data.nextBefore ?? null,
                hasMore: Boolean(data.hasMore),
              };
            }
            const page = await this.fetchSentPage(domain, {
              limit: SEARCH_PAGE_SIZE,
              q,
              before,
            });
            if (!page) return null;
            return {
              domain,
              inbox: [] as RoutingActivityEvent[],
              sent: page.sent,
              nextBefore: page.nextBefore,
              hasMore: page.hasMore,
            };
          } catch {
            return null;
          }
        }),
      );

      if (this.searchGeneration !== generation) return;
      runInAction(() => {
        const inboxByKey = new Map(
          this.searchInboxResults.map((m) => [m.key, m] as const),
        );
        const sentById = new Map(
          this.searchSentResults.map((m) => [m.id, m] as const),
        );
        const nextBefore = { ...this.searchNextBeforeByDomain };
        const hasMore = { ...this.searchHasMoreByDomain };
        for (const result of results) {
          if (!result) continue;
          for (const msg of result.inbox) inboxByKey.set(msg.key, msg);
          for (const msg of result.sent) sentById.set(msg.id, msg);
          nextBefore[result.domain] = result.nextBefore;
          hasMore[result.domain] = result.hasMore;
        }
        this.searchInboxResults = [...inboxByKey.values()].sort((a, b) =>
          b.receivedAt.localeCompare(a.receivedAt),
        );
        this.searchSentResults = [...sentById.values()].sort((a, b) =>
          b.sentAt.localeCompare(a.sentAt),
        );
        this.searchNextBeforeByDomain = nextBefore;
        this.searchHasMoreByDomain = hasMore;
      });
    } finally {
      runInAction(() => {
        this.searchLoadingMore = false;
      });
    }
  }

  clearSearch() {
    this.searchGeneration += 1;
    this.searchQuery = "";
    this.searchFolder = null;
    this.searchInboxResults = [];
    this.searchSentResults = [];
    this.searchTotal = 0;
    this.searchLoading = false;
    this.searchLoadingMore = false;
    this.searchUnavailable = false;
    this.searchNextBeforeByDomain = {};
    this.searchHasMoreByDomain = {};
  }

  private async loadPersistedMail() {
    if (!this.productId) return;
    const [inbox, sent, drafts] = await Promise.all([
      loadPersistedInbox(this.productId),
      loadPersistedSent(this.productId),
      loadPersistedDrafts(this.productId),
    ]);
    runInAction(() => {
      if (inbox && inbox.messages.length > 0) {
        const inboxByKey = new Map<string, RoutingActivityEvent>();
        for (const msg of this.activity) inboxByKey.set(msg.key, msg);
        for (const msg of inbox.messages) inboxByKey.set(msg.key, msg);
        this.activity = [...inboxByKey.values()];
        this.inboxNextBeforeByDomain = {
          ...this.inboxNextBeforeByDomain,
          ...inbox.nextBeforeByDomain,
        };
        this.inboxHasMoreByDomain = {
          ...this.inboxHasMoreByDomain,
          ...inbox.hasMoreByDomain,
        };
        this.inboxTotalByDomain = {
          ...inbox.totalByDomain,
          ...this.inboxTotalByDomain,
        };
        this.inboxUnreadByDomain = {
          ...inbox.unreadByDomain,
          ...this.inboxUnreadByDomain,
        };
        this.mailReady = true;
        this.loading = false;
      }
      if (sent && sent.sent.length > 0) {
        const sentById = new Map<string, SentEmail>();
        for (const msg of this.sent) sentById.set(msg.id, msg);
        for (const msg of sent.sent) sentById.set(msg.id, msg);
        this.sent = [...sentById.values()];
        this.sentNextBeforeByDomain = {
          ...this.sentNextBeforeByDomain,
          ...sent.nextBeforeByDomain,
        };
        this.sentHasMoreByDomain = {
          ...this.sentHasMoreByDomain,
          ...sent.hasMoreByDomain,
        };
        this.sentTotalByDomain = {
          ...sent.totalByDomain,
          ...this.sentTotalByDomain,
        };
        this.mailReady = true;
        this.loading = false;
      }
      if (drafts) {
        // Merge by id — never clobber a newer in-memory draft with a stale disk read.
        const byId = new Map<string, DraftEmail>();
        for (const draft of drafts) byId.set(draft.id, draft);
        for (const draft of this.drafts) {
          const prev = byId.get(draft.id);
          const prevAt = prev ? Date.parse(prev.updatedAt) || 0 : 0;
          const nextAt = Date.parse(draft.updatedAt) || 0;
          if (!prev || nextAt >= prevAt) byId.set(draft.id, draft);
        }
        this.drafts = [...byId.values()].sort((a, b) => {
          const aAt = Date.parse(a.updatedAt) || 0;
          const bAt = Date.parse(b.updatedAt) || 0;
          return bAt - aAt;
        });
        if (this.drafts.length > 0) {
          this.mailReady = true;
          this.loading = false;
        }
      }
    });
  }

  private persistMailLists() {
    if (!this.productId) return;
    void savePersistedInbox(this.productId, {
      messages: this.activity,
      nextBeforeByDomain: this.inboxNextBeforeByDomain,
      hasMoreByDomain: this.inboxHasMoreByDomain,
      totalByDomain: this.inboxTotalByDomain,
      unreadByDomain: this.inboxUnreadByDomain,
    });
    void savePersistedSent(this.productId, {
      sent: this.sent,
      nextBeforeByDomain: this.sentNextBeforeByDomain,
      hasMoreByDomain: this.sentHasMoreByDomain,
      totalByDomain: this.sentTotalByDomain,
    });
  }

  private persistDrafts() {
    if (!this.productId) return;
    void savePersistedDrafts(this.productId, this.drafts);
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
    const detail = (event as CustomEvent<EmailSendFailedDetail>).detail;
    const error = detail?.error || "Send failed";
    if (
      notifyIfCloudflarePlanError({
        error,
        code: detail?.code,
      })
    ) {
      toast.dismiss(SEND_TOAST_ID);
      this.error = null;
      return;
    }
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
            const res = await desktopAwareFetch(
              `${this.apiBase}/inbox/notifications${domainQuery(domain, { limit: "25" })}`,
            );
            if (!res.ok) return;
            const data = await readResponseJson<{
              events?: InboxNotificationEvent[];
            }>(res);
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

      for (const domain of eventsByDomain.keys()) {
        clearEmailCache(this.productId, `inbox:${domain}`);
      }

      // New mail always starts unread on the server (`readAt: null`), so a
      // plain refresh already reflects the correct unread state.
      await this.refresh(true);

      allEvents.sort((a, b) =>
        b.data.receivedAt.localeCompare(a.data.receivedAt),
      );
      void notifyNewMail(
        allEvents.map((event) => ({
          from: event.data.from,
          subject: event.data.subject,
          messageId: event.data.messageId,
          account: event.data.to,
        })),
      );

      await Promise.all(
        [...eventsByDomain.entries()].map(async ([domain, ids]) => {
          try {
            await desktopAwareFetch(`${this.apiBase}/inbox/notifications`, {
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

function sumByDomain(
  domains: string[],
  byDomain: Record<string, number>,
): number | null {
  let sum = 0;
  let seen = false;
  for (const domain of domains) {
    const value = byDomain[domain];
    if (typeof value === "number") {
      sum += value;
      seen = true;
    }
  }
  return seen ? sum : null;
}

function countSentForDomain(messages: SentEmail[], domain: string): number {
  const needle = domain.trim().toLowerCase();
  let count = 0;
  for (const message of messages) {
    if (domainOf(message.from) === needle) count++;
  }
  return count;
}

/** Clear stale hasMore when every message for the domain is already local. */
function reconcileSentHasMoreForDomain(
  messages: SentEmail[],
  domain: string,
  hasMore: Record<string, boolean>,
  totals: Record<string, number>,
): void {
  const total = totals[domain];
  if (typeof total !== "number") return;
  if (countSentForDomain(messages, domain) >= total) {
    hasMore[domain] = false;
  }
}

function oldestSentCursor(
  messages: SentEmail[],
  domain: string,
): string | null {
  const needle = domain.trim().toLowerCase();
  let oldest: SentEmail | null = null;
  for (const message of messages) {
    if (domainOf(message.from) !== needle) continue;
    if (!oldest || message.sentAt.localeCompare(oldest.sentAt) < 0) {
      oldest = message;
    }
  }
  if (!oldest) return null;
  return `${oldest.sentAt}|${oldest.id}`;
}

function oldestInboxCursor(
  messages: RoutingActivityEvent[],
  domain: string,
): string | null {
  const needle = domain.trim().toLowerCase();
  let oldest: RoutingActivityEvent | null = null;
  for (const message of messages) {
    if (domainOf(message.toEmail) !== needle) continue;
    if (!oldest || message.receivedAt.localeCompare(oldest.receivedAt) < 0) {
      oldest = message;
    }
  }
  if (!oldest) return null;
  return `${oldest.receivedAt}|${oldest.key}`;
}

/** Prefer network list metadata while preserving locally cached body fields. */
function pickListFields(
  msg: RoutingActivityEvent,
): Pick<
  RoutingActivityEvent,
  | "fromEmail"
  | "fromName"
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
  | "readAt"
> {
  return {
    fromEmail: msg.fromEmail,
    fromName: msg.fromName ?? null,
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
    readAt: msg.readAt ?? null,
  };
}
