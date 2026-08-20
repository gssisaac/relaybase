"use client";

import {
  hydrateAccountsUiState,
  setDomainExpanded,
} from "@/console/pages/accounts/accounts-ui-state";
import { AccountDetailSheet } from "@/console/pages/accounts/AccountDetailSheet";
import {
  accountDetailFromSearch,
  accountDetailHref,
  type AccountDetailTab,
  useDashboardPaths,
} from "@/console/lib/paths";
import { fetchEmailCached } from "@/email/components/mailbox/email-cached-fetch";
import {
  Globe,
  Loader2,
  MailX,
  MoreHorizontal,
  PenLine,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useProductId } from "@/lib/dashboard/shared/ProductContext";
import { useAccounts } from "@/lib/dashboard/AccountsContext";
import { notifyAddressesChanged } from "@/lib/dashboard/accounts-sync";
import {
  DEFAULT_ADDRESS_DISPLAY_NAMES,
  DEFAULT_ADDRESS_LOCAL_PARTS,
  defaultInboundEnabledForLocalPart,
  suggestedDisplayNameForLocalPart,
  useDomain,
} from "@/lib/dashboard/DomainContext";
import {
  desktopAwareFetch,
  readResponseJson,
} from "@/lib/desktop/api-base";

import {
  CloudflareConfigAlert,
  EmailAlerts,
} from "@/email/components/mailbox/EmailShared";
import { clearEmailCache } from "@/email/components/mailbox/email-cached-fetch";
import { readEmailStale } from "@/email/components/mailbox/useEmailViewLoading";
import type { Address, EmailConfig } from "@/email/components/mailbox/types";
import { DesktopTitleBar } from "@/components/layout/DesktopTitleBar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldCheck } from "@/components/ui/field-check";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

function initialDefaultSelection(): Record<string, boolean> {
  return Object.fromEntries(
    DEFAULT_ADDRESS_LOCAL_PARTS.map((part) => [part, true]),
  );
}

/** Total received + unread for one address row — always shown so status is auditable. */
function AddressCountsSummary({
  total,
  unread,
  ready,
}: {
  total: number;
  unread: number;
  /** False until counts have been hydrated for this domain. */
  ready: boolean;
}) {
  if (!ready) {
    return (
      <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-2 whitespace-nowrap text-xs tabular-nums"
      aria-label={`${total} received, ${unread} unread`}
    >
      <span className="text-muted-foreground">
        <span className="font-medium text-foreground">{total}</span> received
      </span>
      <span
        className={
          unread > 0
            ? "inline-flex items-center gap-1 font-semibold text-foreground"
            : "text-muted-foreground"
        }
      >
        {unread > 0 ? (
          <span
            className="inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
            aria-hidden
          >
            {unread > 99 ? "99+" : unread}
          </span>
        ) : (
          <span className="font-medium text-foreground">0</span>
        )}{" "}
        unread
      </span>
    </span>
  );
}

type DomainFilter = "all" | string;

type RemoveTarget = { domain: string; email: string };

type RenameTarget = {
  domain: string;
  email: string;
  displayName: string;
};

const COMPACT_EMAIL_PREVIEW_COUNT = 2;

/** e.g. `a@x.com, b@x.com + 3 more` */
function compactEmailPreview(emails: string[], take = COMPACT_EMAIL_PREVIEW_COUNT) {
  if (emails.length === 0) return null;
  const shown = emails.slice(0, take);
  const rest = emails.length - shown.length;
  const list = shown.join(", ");
  return rest > 0 ? `${list} + ${rest} more` : list;
}

export function AccountsView() {
  const productId = useProductId();
  const router = useRouter();
  const { apiBase, accounts: accountsHref, domains: domainsHref } =
    useDashboardPaths();
  const searchParams = useSearchParams();
  const accountDetail = accountDetailFromSearch(searchParams);
  const { domains, loading: domainsLoading } = useDomain();
  const accountsStore = useAccounts();

  const readyDomains = useMemo(
    () =>
      domains.filter(
        (entry) => !entry.onboarding || entry.onboarding.status === "ready",
      ),
    [domains],
  );

  const [domainFilter, setDomainFilter] = useState<DomainFilter>("all");
  const [config, setConfig] = useState<EmailConfig | null>(() =>
    readEmailStale<EmailConfig>(productId, "config"),
  );
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  /** When true (default), noreply is created with inbound drop. */
  const [blockNoreplyInbound, setBlockNoreplyInbound] = useState(true);
  const [dialogDomain, setDialogDomain] = useState("");
  const [selectedDefaults, setSelectedDefaults] = useState(
    initialDefaultSelection,
  );
  const [localPart, setLocalPart] = useState("");
  const [displayName, setDisplayName] = useState("");
  /** Add-account dialog: accept inbound (off for noreply by default). */
  const [addInboundEnabled, setAddInboundEnabled] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameDisplayName, setRenameDisplayName] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  /** Domains with expanded cards. Default / missing = collapsed compact. */
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    let cancelled = false;
    void hydrateAccountsUiState(productId).then((state) => {
      if (cancelled) return;
      setExpandedDomains(new Set(state.expandedDomains));
    });
    return () => {
      cancelled = true;
    };
  }, [productId]);

  const toggleDomainExpanded = useCallback(
    (domain: string) => {
      const key = domain.trim().toLowerCase();
      if (!key) return;
      setExpandedDomains((prev) => {
        const next = new Set(prev);
        const expanded = !next.has(key);
        if (expanded) next.add(key);
        else next.delete(key);
        setDomainExpanded(productId, key, expanded);
        return next;
      });
    },
    [productId],
  );

  const ensureDomainExpanded = useCallback(
    (domain: string) => {
      const key = domain.trim().toLowerCase();
      if (!key) return;
      setExpandedDomains((prev) => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        setDomainExpanded(productId, key, true);
        return next;
      });
    },
    [productId],
  );

  const visibleDomains = useMemo(() => {
    if (domainFilter === "all") return readyDomains;
    return readyDomains.filter((d) => d.domain === domainFilter);
  }, [domainFilter, readyDomains]);

  const visibleDomainKeys = useMemo(
    () => visibleDomains.map((d) => d.domain),
    [visibleDomains],
  );

  const saving = accountsStore.saving;
  const error = configError ?? accountsStore.error;
  const message = accountsStore.message;

  const refreshing = visibleDomainKeys.some(
    (key) => accountsStore.refreshingDomain === key.toLowerCase(),
  );

  const loading =
    domainsLoading ||
    (visibleDomainKeys.length > 0 &&
      visibleDomainKeys.every(
        (key) =>
          !accountsStore.hasHydrated(key) &&
          accountsStore.loadingDomain === key.toLowerCase(),
      ));

  // Drop filter selection if that domain disappears.
  useEffect(() => {
    if (domainFilter === "all") return;
    if (!readyDomains.some((d) => d.domain === domainFilter)) {
      setDomainFilter("all");
    }
  }, [domainFilter, readyDomains]);

  const refreshConfig = useCallback(
    async (force?: boolean) => {
      setConfigError(null);
      try {
        const cfgResult = await fetchEmailCached<EmailConfig>(
          productId,
          "config",
          `${apiBase}/config`,
          {
            refresh: force,
            onUpdate: (data) => setConfig(data),
          },
        );
        setConfig(cfgResult.data);
      } catch (e) {
        setConfigError(e instanceof Error ? e.message : "Refresh failed");
      }
    },
    [apiBase, productId],
  );

  const refreshAddresses = useCallback(
    async (force?: boolean) => {
      await Promise.all(
        visibleDomainKeys.map((domain) =>
          Promise.all([
            accountsStore.refresh(domain, force),
            accountsStore.refreshCounts(domain, force),
          ]),
        ),
      );
    },
    [accountsStore, visibleDomainKeys],
  );

  const refresh = useCallback(
    async (force?: boolean) => {
      await Promise.all([refreshConfig(force), refreshAddresses(force)]);
    },
    [refreshAddresses, refreshConfig],
  );

  const visibleDomainKeysKey = visibleDomainKeys.join(",");

  useEffect(() => {
    void refresh();
  }, [refresh, visibleDomainKeysKey]);

  const searchQuery = search.trim().toLowerCase();

  // Read addresses during render (useAccounts re-renders on store updates).
  const accountsByDomain = new Map<string, Address[]>();
  for (const entry of visibleDomains) {
    const list = accountsStore.addressesFor(entry.domain);
    const filtered = searchQuery
      ? list.filter(
          (a) =>
            a.email.toLowerCase().includes(searchQuery) ||
            (a.displayName?.toLowerCase().includes(searchQuery) ?? false),
        )
      : list;
    accountsByDomain.set(entry.domain, filtered);
  }

  const selectedDefaultParts = useMemo(
    () => DEFAULT_ADDRESS_LOCAL_PARTS.filter((part) => selectedDefaults[part]),
    [selectedDefaults],
  );

  function openAddDialog(domain: string) {
    setDialogDomain(domain);
    setLocalPart("");
    setDisplayName("");
    setAddInboundEnabled(true);
    setAddOpen(true);
  }

  function openDefaultsDialog(domain: string) {
    setDialogDomain(domain);
    setSelectedDefaults(initialDefaultSelection());
    setBlockNoreplyInbound(true);
    setDefaultsOpen(true);
  }

  function addAccount() {
    const domainKey = dialogDomain.trim().toLowerCase();
    const part = localPart.trim();
    if (!domainKey || !part) return;
    const input = {
      localPart: part,
      displayName:
        displayName.trim() || suggestedDisplayNameForLocalPart(part),
      inboundEnabled: addInboundEnabled,
    };
    setLocalPart("");
    setDisplayName("");
    setAddInboundEnabled(true);
    setAddOpen(false);
    ensureDomainExpanded(domainKey);
    void accountsStore.create(domainKey, input).catch(() => {
      // toast + optimistic rollback handled in store
    });
  }

  function addDefaultAccounts() {
    const domainKey = dialogDomain.trim().toLowerCase();
    if (!domainKey || !selectedDefaultParts.length) return;
    const displayNames = Object.fromEntries(
      selectedDefaultParts.map((part) => [
        part,
        DEFAULT_ADDRESS_DISPLAY_NAMES[part],
      ]),
    );
    const inboundEnabledByLocalPart = Object.fromEntries(
      selectedDefaultParts.map((part) => [
        part,
        part === "noreply" ? !blockNoreplyInbound : true,
      ]),
    );
    const input = {
      localParts: [...selectedDefaultParts],
      displayNames,
      inboundEnabledByLocalPart,
    };
    setDefaultsOpen(false);
    setSelectedDefaults(initialDefaultSelection());
    setBlockNoreplyInbound(true);
    ensureDomainExpanded(domainKey);
    void accountsStore.create(domainKey, input).catch(() => {
      // toast + optimistic rollback handled in store
    });
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    accountsStore.clearError();
    try {
      await accountsStore.remove(removeTarget.domain, removeTarget.email);
      setRemoveTarget(null);
    } catch {
      // error already on store
    }
  }

  function openRenameDialog(address: Address, domain: string) {
    setRenameTarget({
      domain,
      email: address.email,
      displayName: address.displayName ?? "",
    });
    setRenameDisplayName(address.displayName ?? "");
  }

  function openAccountDetail(email: string, tab: AccountDetailTab = "overview") {
    router.replace(accountDetailHref(email, tab));
  }

  function closeAccountDetail() {
    router.replace(accountsHref);
  }

  function setAccountDetailTab(tab: AccountDetailTab) {
    if (!accountDetail) return;
    router.replace(accountDetailHref(accountDetail.email, tab));
  }

  async function saveRename() {
    if (!renameTarget) return;
    setRenameSaving(true);
    accountsStore.clearError();
    try {
      const res = await desktopAwareFetch(`${apiBase}/addresses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: renameTarget.email,
          displayName: renameDisplayName,
        }),
      });
      const data = await readResponseJson<{ error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Failed to save display name");
      toast.success("Display name saved");
      clearEmailCache(productId, `addresses:${renameTarget.domain}`);
      clearEmailCache(productId, "addresses:all");
      notifyAddressesChanged({
        domain: renameTarget.domain,
        emails: [renameTarget.email],
      });
      await accountsStore.refresh(renameTarget.domain, true);
      setRenameTarget(null);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to save display name",
      );
    } finally {
      setRenameSaving(false);
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DesktopTitleBar
        className="px-4 py-3"
        end={
          <>
            <Select
              value={domainFilter}
              onValueChange={(next) => {
                if (next) setDomainFilter(next);
              }}
              disabled={domainsLoading || readyDomains.length === 0}
            >
              <SelectTrigger className="h-8 w-[220px]" size="sm">
                <SelectValue
                  placeholder={
                    domainsLoading ? "Loading domains…" : "Filter domain"
                  }
                >
                  {(value: string | null) => {
                    if (!value || value === "all") return "All";
                    return value;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {readyDomains.map((entry) => (
                  <SelectItem key={entry.domain} value={entry.domain}>
                    {entry.domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accounts…"
                className="h-8 w-[200px] pl-8 text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={refreshing ? "size-4 animate-spin" : "size-4"}
              />
            </Button>
          </>
        }
      >
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">
            Accounts
          </h1>
          <p className="text-sm text-muted-foreground">
            Send-from addresses across your domains
          </p>
        </div>
      </DesktopTitleBar>

      <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1200px] space-y-4 p-4">
        <EmailAlerts error={error} message={message} />
        <CloudflareConfigAlert show={!config?.cloudflareConfigured} />

        {!domainsLoading && readyDomains.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">No ready domains</CardTitle>
              <CardDescription>
                Finish onboarding a domain before adding accounts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" nativeButton={false} render={<Link href={domainsHref} />}>
                Manage domains
              </Button>
            </CardContent>
          </Card>
        ) : loading && visibleDomains.length === 0 ? (
          <div className="min-h-[200px]" />
        ) : (
          <div className="space-y-4">
            {visibleDomains
              .filter((entry) => {
                if (!searchQuery) return true;
                if (!accountsStore.hasHydrated(entry.domain)) return true;
                return (accountsByDomain.get(entry.domain)?.length ?? 0) > 0;
              })
              .map((entry) => {
                const domainAddresses = accountsByDomain.get(entry.domain) ?? [];
                const totalCount = accountsStore.addressesFor(entry.domain).length;
                const domainKey = entry.domain.toLowerCase();
                const expanded = expandedDomains.has(domainKey);
                const domainLoading =
                  !accountsStore.hasHydrated(entry.domain) &&
                  accountsStore.loadingDomain === domainKey;
                const accountSummary =
                  totalCount === 0
                    ? "No accounts yet"
                    : `${totalCount} account${totalCount === 1 ? "" : "s"}`;
                const emailPreview = !expanded
                  ? compactEmailPreview(
                      domainAddresses.map((a) => a.email),
                    )
                  : null;
                const countsReady = accountsStore.hasHydratedCounts(
                  entry.domain,
                );
                const domainUnread = countsReady
                  ? accountsStore
                      .addressesFor(entry.domain)
                      .reduce((sum, a) => {
                        if (a.inboundEnabled === false) return sum;
                        return sum + (accountsStore.countsFor(entry.domain, a.email)?.unread ?? 0);
                      }, 0)
                  : 0;

                return (
                  <Card key={entry.domain}>
                    <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0 pb-4">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-ring"
                        aria-expanded={expanded}
                        aria-label={
                          expanded
                            ? `Collapse ${entry.domain}`
                            : `Expand ${entry.domain}`
                        }
                        onClick={() => toggleDomainExpanded(entry.domain)}
                      >
                        <div className="min-w-0 space-y-0.5">
                          <CardTitle className="flex items-center gap-2 text-base">
                            <Globe
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="truncate">{entry.domain}</span>
                            {domainUnread > 0 ? (
                              <span
                                className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground tabular-nums"
                                aria-label={`${domainUnread} unread`}
                              >
                                {domainUnread > 99 ? "99+" : domainUnread}
                              </span>
                            ) : null}
                          </CardTitle>
                          <CardDescription>
                            {accountSummary}
                            {searchQuery && totalCount > 0
                              ? ` · ${domainAddresses.length} shown`
                              : null}
                          </CardDescription>
                          {emailPreview ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {emailPreview}
                            </p>
                          ) : null}
                        </div>
                      </button>
                      <Button
                        size="sm"
                        onClick={() => openAddDialog(entry.domain)}
                      >
                        <Plus className="size-4" />
                        Add account
                      </Button>
                    </CardHeader>
                    {expanded ? (
                      <CardContent className="px-0 pb-0">
                        {domainLoading ? (
                          <div className="min-h-[80px] px-6" />
                        ) : domainAddresses.length > 0 ? (
                          <div className="overflow-hidden rounded-b-xl">
                            <Table>
                              <TableBody>
                                {domainAddresses.map((address) => {
                                  const label =
                                    address.displayName?.trim() ||
                                    address.email.split("@")[0] ||
                                    address.email;
                                  const counts = accountsStore.countsFor(
                                    entry.domain,
                                    address.email,
                                  );
                                  const countsReady =
                                    accountsStore.hasHydratedCounts(
                                      entry.domain,
                                    );
                                  const creating = accountsStore.isCreating(
                                    address.email,
                                  );
                                  return (
                                    <TableRow
                                      key={address.email}
                                      className={cn(
                                        "border-0",
                                        !creating && "cursor-pointer",
                                      )}
                                      onClick={
                                        creating
                                          ? undefined
                                          : () =>
                                              openAccountDetail(address.email)
                                      }
                                    >
                                      <TableCell className="w-[42%] max-w-0 px-4 py-3 font-medium">
                                        <span className="block truncate">
                                          {address.email}
                                        </span>
                                      </TableCell>
                                      <TableCell className="w-[22%] max-w-0 px-4 py-3 text-muted-foreground">
                                        <span className="block truncate">
                                          {label}
                                        </span>
                                      </TableCell>
                                      <TableCell className="w-[28%] px-4 py-3 text-right">
                                        {creating ? (
                                          <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                                            <Loader2
                                              className="size-3.5 animate-spin"
                                              aria-hidden
                                            />
                                            Adding…
                                          </span>
                                        ) : address.inboundEnabled ===
                                          false ? (
                                          <span className="whitespace-nowrap text-xs text-muted-foreground">
                                            Inbound off
                                          </span>
                                        ) : (
                                          <div className="flex justify-end">
                                            <AddressCountsSummary
                                              total={counts?.total ?? 0}
                                              unread={counts?.unread ?? 0}
                                              ready={countsReady}
                                            />
                                          </div>
                                        )}
                                      </TableCell>
                                      <TableCell className="w-10 px-2 py-3 text-right">
                                        {creating ? (
                                          <span className="inline-block size-7" />
                                        ) : (
                                          <DropdownMenu>
                                            <DropdownMenuTrigger
                                              render={
                                                <Button
                                                  type="button"
                                                  variant="ghost"
                                                  size="icon-xs"
                                                  className="text-muted-foreground"
                                                  disabled={saving}
                                                  aria-label={`More actions for ${address.email}`}
                                                  onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                  }}
                                                />
                                              }
                                            >
                                              <MoreHorizontal className="size-3.5" />
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                              align="end"
                                              className="min-w-52"
                                              onClick={(e) =>
                                                e.stopPropagation()
                                              }
                                            >
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  openRenameDialog(
                                                    address,
                                                    entry.domain,
                                                  )
                                                }
                                              >
                                                <PenLine className="size-3.5" />
                                                Change display name
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                closeOnClick={false}
                                                onClick={(e) =>
                                                  e.preventDefault()
                                                }
                                              >
                                                <div className="flex w-full items-center justify-between gap-4">
                                                  <span className="inline-flex items-center gap-2.5">
                                                    <MailX className="size-3.5 shrink-0" />
                                                    Inbound off
                                                  </span>
                                                  <Switch
                                                    size="sm"
                                                    checked={
                                                      address.inboundEnabled ===
                                                      false
                                                    }
                                                    disabled={accountsStore.isInboundPending(
                                                      address.email,
                                                    )}
                                                    onCheckedChange={(off) =>
                                                      void accountsStore.setInboundEnabled(
                                                        entry.domain,
                                                        address.email,
                                                        !off,
                                                      )
                                                    }
                                                  />
                                                </div>
                                              </DropdownMenuItem>
                                              <DropdownMenuItem
                                                variant="destructive"
                                                onClick={() =>
                                                  setRemoveTarget({
                                                    domain: entry.domain,
                                                    email: address.email,
                                                  })
                                                }
                                              >
                                                <Trash2 className="size-3.5" />
                                                Delete
                                              </DropdownMenuItem>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="flex flex-col items-start gap-3 px-6 pb-6">
                            <div>
                              <p className="text-sm font-medium">
                                No accounts yet
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Add an address to send from and receive mail on
                                this domain.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                onClick={() => openAddDialog(entry.domain)}
                              >
                                Add account
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  openDefaultsDialog(entry.domain)
                                }
                              >
                                Add defaults 6 accounts
                              </Button>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    ) : null}
                  </Card>
                );
              })}
            {searchQuery &&
            visibleDomains.every(
              (entry) =>
                accountsStore.hasHydrated(entry.domain) &&
                (accountsByDomain.get(entry.domain)?.length ?? 0) === 0,
            ) ? (
              <p className="text-sm text-muted-foreground">
                No accounts match “{search.trim()}”.
              </p>
            ) : null}
          </div>
        )}

        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setLocalPart("");
              setDisplayName("");
              setAddInboundEnabled(true);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add account</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Alert>
                <AlertDescription className="text-xs">
                  Adds a send-from address and creates an Email Routing rule so
                  replies to this address land in Inbox. No per-address
                  verification once the domain is onboarded.
                </AlertDescription>
              </Alert>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Local part</Label>
                  <Input
                    value={localPart}
                    onChange={(e) => {
                      const next = e.target.value;
                      setLocalPart(next);
                      setDisplayName(suggestedDisplayNameForLocalPart(next));
                      setAddInboundEnabled(
                        defaultInboundEnabledForLocalPart(next),
                      );
                    }}
                    placeholder="support"
                  />
                </div>
                <span className="pb-2 text-sm text-muted-foreground">
                  @{dialogDomain}
                </span>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Support Team"
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the From name when sending from this address.
                </p>
              </div>
              <div className="flex items-start justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
                <div className="min-w-0 space-y-1">
                  <Label
                    htmlFor="add-account-accept-inbound"
                    className="text-sm font-medium"
                  >
                    Accept inbound mail
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {addInboundEnabled
                      ? "Replies land in the Relaybase inbox."
                      : "Replies are dropped at Cloudflare (Inbound off)."}
                  </p>
                </div>
                <Switch
                  id="add-account-accept-inbound"
                  checked={addInboundEnabled}
                  onCheckedChange={setAddInboundEnabled}
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={!localPart.trim() || !dialogDomain}
                onClick={() => addAccount()}
              >
                Add
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={defaultsOpen}
          onOpenChange={(open) => {
            setDefaultsOpen(open);
            if (open) {
              setSelectedDefaults(initialDefaultSelection());
              setBlockNoreplyInbound(true);
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add standard accounts</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Create the usual product addresses on{" "}
                <span className="font-mono">
                  {dialogDomain || "your domain"}
                </span>
                . Uncheck any you do not need.
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {DEFAULT_ADDRESS_LOCAL_PARTS.map((part) => (
                  <div key={part} className="space-y-2">
                    <FieldCheck
                      id={`default-account-${part}`}
                      checked={Boolean(selectedDefaults[part])}
                      onCheckedChange={(on) =>
                        setSelectedDefaults((prev) => ({
                          ...prev,
                          [part]: on,
                        }))
                      }
                      label={`${part}@${dialogDomain || "…"}`}
                      description={DEFAULT_ADDRESS_DISPLAY_NAMES[part]}
                    />
                    {part === "noreply" && selectedDefaults.noreply ? (
                      <FieldCheck
                        id="default-account-noreply-block-inbound"
                        className="ml-6"
                        checked={blockNoreplyInbound}
                        onCheckedChange={setBlockNoreplyInbound}
                        label="Block inbound mail"
                        description="Replies to noreply@ are dropped at Cloudflare (recommended)."
                      />
                    ) : null}
                  </div>
                ))}
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={!dialogDomain || selectedDefaultParts.length === 0}
                onClick={() => addDefaultAccounts()}
              >
                {`Add selected (${selectedDefaultParts.length})`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(renameTarget)}
          onOpenChange={(open) => {
            if (!open && !renameSaving) setRenameTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md" showCloseButton={!renameSaving}>
            <DialogHeader>
              <DialogTitle>Change display name</DialogTitle>
              <DialogDescription>
                From name for{" "}
                <span className="font-mono text-foreground">
                  {renameTarget?.email}
                </span>
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rename-display-name">Display name</Label>
                <Input
                  id="rename-display-name"
                  value={renameDisplayName}
                  onChange={(e) => setRenameDisplayName(e.target.value)}
                  placeholder="Optional"
                  disabled={renameSaving}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void saveRename();
                    }
                  }}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={renameSaving}
                  onClick={() => setRenameTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={renameSaving}
                  onClick={() => void saveRename()}
                >
                  {renameSaving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(removeTarget)}
          onOpenChange={(open) => {
            if (!open && !saving) setRemoveTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
            <DialogHeader>
              <DialogTitle>Delete account</DialogTitle>
              <DialogDescription>
                Delete{" "}
                <span className="font-mono text-foreground">
                  {removeTarget?.email}
                </span>
                ? It will be removed from this domain and from Email add-account
                options. Mail already received is kept.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={saving}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={saving}
                onClick={() => void confirmRemove()}
              >
                {saving ? "Deleting…" : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={Boolean(accountsStore.mxConflictDomain)}
          onOpenChange={(open) => {
            if (!open && !accountsStore.mxResolving) {
              accountsStore.clearMxConflict();
            }
          }}
        >
          <DialogContent
            className="sm:max-w-lg"
            showCloseButton={!accountsStore.mxResolving}
          >
            <DialogHeader>
              <DialogTitle>Conflicting MX records</DialogTitle>
              <DialogDescription className="text-left">
                <span className="font-mono text-foreground">
                  {accountsStore.mxConflictDomain}
                </span>{" "}
                already has apex MX records for another mail provider (for
                example Google Workspace). Cloudflare Email Routing cannot
                share those records.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 text-sm">
              <p className="font-medium text-destructive">
                Deleting them will stop inbound mail delivery to the previous
                provider. Existing Workspace (or other) inboxes for this domain
                will no longer receive mail.
              </p>
              <p className="text-muted-foreground">
                Sending DNS on{" "}
                <span className="font-mono">
                  cf-bounce.{accountsStore.mxConflictDomain}
                </span>{" "}
                is not affected.
              </p>
            </div>
            {accountsStore.mxConflicts.length ? (
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-md border p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Records to delete
                </p>
                <ul className="space-y-1.5 font-mono text-xs">
                  {accountsStore.mxConflicts.map((mx) => (
                    <li key={mx.id} className="break-all">
                      MX {mx.name} → {mx.content}
                      {mx.priority != null ? ` (priority ${mx.priority})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No conflicting apex MX records are listed. Confirming will retry
                enabling Email Routing.
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={accountsStore.mxResolving}
                onClick={() => accountsStore.clearMxConflict()}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={accountsStore.mxResolving}
                onClick={() => {
                  void accountsStore.resolveMxConflict().catch(() => {
                    // error toast + state handled in store
                  });
                }}
              >
                {accountsStore.mxResolving
                  ? "Deleting & continuing…"
                  : "Delete MX & enable Routing"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AccountDetailSheet
          email={accountDetail?.email ?? ""}
          tab={accountDetail?.tab ?? "overview"}
          open={Boolean(accountDetail)}
          onOpenChange={(next) => {
            if (!next) closeAccountDetail();
          }}
          onTabChange={setAccountDetailTab}
        />
      </div>
      </div>
    </div>
  );
}
