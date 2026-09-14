"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  displayNameForAddress,
  useDomainAddresses,
} from "@/crm/lib/use-domain-addresses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

import { crmAudienceDetailHref } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { useWorkerDomains } from "@/crm/lib/use-worker-domains";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { crmApi, CrmApiError } from "@/lib/crm/api";

export function BroadcastSettingsView() {
  const { broadcastId, broadcast, templates, setBroadcast } = useBroadcastDetail();
  const { readyDomainNames, loading: domainsLoading, refresh: refreshWorkerDomains } =
    useWorkerDomains();

  const [sendDomain, setSendDomain] = useState<string | null>(null);
  const { domainAddresses, displayNameOptions, loading: addressesLoading } =
    useDomainAddresses(sendDomain);

  const [fromName, setFromName] = useState<string | null>(broadcast?.fromName ?? null);
  const [fromEmail, setFromEmail] = useState<string | null>(broadcast?.fromEmail ?? null);
  const [replyTo, setReplyTo] = useState(broadcast?.replyTo ?? "");
  const [defaultTemplateId, setDefaultTemplateId] = useState(broadcast?.defaultTemplateId ?? "");
  const [fromEmailError, setFromEmailError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBlocked, setArchiveBlocked] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [organizationName, setOrganizationName] = useState("");
  const [postalAddress, setPostalAddress] = useState("");
  const [complianceContactEmail, setComplianceContactEmail] = useState("");
  const [savingCompliance, setSavingCompliance] = useState(false);
  const [complianceFlash, setComplianceFlash] = useState(false);

  useEffect(() => {
    if (!broadcast) return;
    setFromName(broadcast.fromName ?? null);
    setFromEmail(broadcast.fromEmail ?? null);
    setSendDomain(broadcast.domain ?? broadcast.audienceGroupDomain ?? null);
  }, [broadcast]);

  useEffect(() => {
    crmApi
      .getAccountLink()
      .then((link) => {
        setOrganizationName(link.compliance?.organizationName ?? "");
        setPostalAddress(link.compliance?.postalAddress ?? "");
        setComplianceContactEmail(link.compliance?.contactEmail ?? "");
      })
      .catch(() => {});
  }, [broadcastId]);

  useEffect(() => {
    void refreshWorkerDomains();
  }, [refreshWorkerDomains]);

  const domainOptionValues = useMemo(() => {
    const values = new Set(readyDomainNames);
    const pinned = (sendDomain ?? broadcast?.domain ?? broadcast?.audienceGroupDomain)?.trim();
    if (pinned) values.add(pinned);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [readyDomainNames, sendDomain, broadcast?.domain, broadcast?.audienceGroupDomain]);

  const domainMismatch =
    Boolean(sendDomain && broadcast?.audienceGroupDomain) &&
    sendDomain!.toLowerCase() !== broadcast!.audienceGroupDomain!.toLowerCase();

  const domainLocked = broadcast?.status !== "draft";
  const domainSelectDisabled =
    domainLocked || (domainsLoading && domainOptionValues.length === 0);

  const emailOptions = useMemo(() => {
    const emails = domainAddresses.map((a) => a.email);
    if (fromEmail && !emails.some((e) => e.toLowerCase() === fromEmail.toLowerCase())) {
      emails.unshift(fromEmail);
    }
    return emails;
  }, [domainAddresses, fromEmail]);

  const nameOptions = useMemo(() => {
    const names = [...displayNameOptions];
    if (fromName && !names.includes(fromName)) names.unshift(fromName);
    return names;
  }, [displayNameOptions, fromName]);

  const allowedEmails = useMemo(
    () => new Set(emailOptions.map((e) => e.toLowerCase())),
    [emailOptions],
  );

  if (!broadcast) return null;

  async function saveIdentity() {
    if (!sendDomain) {
      setFromEmailError("Select a sending domain");
      return;
    }
    if (domainMismatch) {
      setFromEmailError(
        `Audience is on ${broadcast.audienceGroupDomain}. Match that domain or change the linked audience.`,
      );
      return;
    }
    if (fromEmail && !allowedEmails.has(fromEmail.toLowerCase())) {
      setFromEmailError("Select a sender address from your accounts on this domain");
      return;
    }
    setFromEmailError(null);
    setSavingIdentity(true);
    try {
      const workerUrl = resolveEmailApiBase();
      const updated = await crmApi.updateBroadcast(broadcastId, {
        domain: sendDomain,
        ...(workerUrl ? { workerUrl } : {}),
        fromName: fromName?.trim() || null,
        fromEmail: fromEmail?.trim() || null,
        replyTo: replyTo.trim() || null,
        defaultTemplateId: defaultTemplateId || null,
      });
      setBroadcast(updated);
      toast.success("Broadcast settings saved");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      if (err instanceof CrmApiError) setFromEmailError(err.message);
      else toast.error("Could not save settings");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const updated = await crmApi.archiveBroadcast(broadcastId);
      setBroadcast(updated);
      setArchiveOpen(false);
      toast.success("Broadcast archived");
    } catch (err) {
      if (err instanceof CrmApiError) {
        setArchiveOpen(false);
        setArchiveBlocked(err.message);
      } else {
        toast.error("Could not archive broadcast");
      }
    } finally {
      setArchiving(false);
    }
  }

  async function saveCompliance() {
    setSavingCompliance(true);
    try {
      await crmApi.updateAccountLink({
        compliance: {
          organizationName: organizationName.trim() || null,
          postalAddress: postalAddress.trim() || null,
          contactEmail: complianceContactEmail.trim() || null,
        },
      });
      toast.success("Compliance footer settings saved");
      setComplianceFlash(true);
      setTimeout(() => setComplianceFlash(false), 2000);
    } catch (err) {
      toast.error(err instanceof CrmApiError ? err.message : "Could not save compliance settings");
    } finally {
      setSavingCompliance(false);
    }
  }

  async function handleUnarchive() {
    try {
      const updated = await crmApi.unarchiveBroadcast(broadcastId);
      setBroadcast(updated);
      toast.success("Broadcast reactivated");
    } catch {
      toast.error("Could not reactivate campaign");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Sender identity and defaults for this broadcast.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Audience</CardTitle>
          <CardDescription>
            Contacts and data sources are managed in Audience. Send eligibility is on the Audience tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {broadcast.audienceGroupName ?? "No audience linked"}
            </p>
            {broadcast.audienceGroupDomain ? (
              <p className="truncate text-xs text-muted-foreground">{broadcast.audienceGroupDomain}</p>
            ) : null}
          </div>
          {broadcast.audienceGroupId ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={crmAudienceDetailHref(broadcast.audienceGroupId)} />}
            >
              Open audience
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender identity</CardTitle>
          <CardDescription>Future edits inherit these sender defaults.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="send-domain">Domain</Label>
            <Select
              value={sendDomain}
              onValueChange={(next) => {
                if (!next) {
                  setSendDomain(null);
                  return;
                }
                setSendDomain(next);
                setFromEmail(null);
                setFromName(null);
              }}
              disabled={domainSelectDisabled}
            >
              <SelectTrigger id="send-domain" className="w-full">
                <SelectValue
                  placeholder={
                    domainsLoading
                      ? "Loading domains…"
                      : domainOptionValues.length === 0
                        ? "No domains in Console"
                        : "Select sending domain"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {domainOptionValues.map((domain) => (
                  <SelectItem key={domain} value={domain}>
                    {domain}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {domainLocked ? (
              <p className="text-xs text-muted-foreground">
                Domain can only be changed while the broadcast is a draft (current status:{" "}
                {broadcast.status}). Duplicate the broadcast to pick a different domain.
              </p>
            ) : domainsLoading ? (
              <p className="text-xs text-muted-foreground">Loading domains from Worker…</p>
            ) : domainOptionValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No domains on your Worker — add one in Console → Domains.
              </p>
            ) : domainMismatch ? (
              <p className="text-xs text-destructive">
                Audience is on {broadcast.audienceGroupDomain}. Pick that domain to send.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Same Worker domain catalog as when you create a broadcast.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from-email">From email</Label>
            <Select
              value={fromEmail}
              onValueChange={(email) => {
                if (!email) {
                  setFromEmail(null);
                  return;
                }
                setFromEmail(email);
                const match = domainAddresses.find((a) => a.email === email);
                if (match) setFromName(displayNameForAddress(match));
              }}
              disabled={addressesLoading || emailOptions.length === 0}
            >
              <SelectTrigger id="from-email" className="w-full">
                <SelectValue
                  placeholder={
                    addressesLoading
                      ? "Loading accounts…"
                      : emailOptions.length === 0
                        ? "No senders on this domain"
                        : "Select sender address"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {emailOptions.map((email) => (
                  <SelectItem key={email} value={email}>
                    {email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fromEmailError ? <p className="text-xs text-destructive">{fromEmailError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from-name">From name</Label>
            <Select
              value={fromName}
              onValueChange={(name) => setFromName(name)}
              disabled={nameOptions.length === 0}
            >
              <SelectTrigger id="from-name" className="w-full">
                <SelectValue placeholder="Select display name" />
              </SelectTrigger>
              <SelectContent>
                {nameOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Senders come from Accounts on{" "}
              {sendDomain ?? "the audience domain"}.
              {domainAddresses.length === 0 && !addressesLoading
                ? " Add an address in Console → Accounts first."
                : null}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reply-to">Reply-to</Label>
            <Input
              id="reply-to"
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="support@yourdomain.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="default-template">Default template</Label>
            <Select
              items={templates.map((t) => ({ value: t.id, label: t.name }))}
              value={defaultTemplateId || null}
              onValueChange={(next) => setDefaultTemplateId(next ?? "")}
            >
              <SelectTrigger id="default-template" className="w-full">
                <SelectValue placeholder="No default" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm" onClick={() => void saveIdentity()} disabled={savingIdentity}>
            {savingIdentity ? "Saving…" : "Save"}
          </Button>
          {savedFlash ? <span className="text-xs text-emerald-600">✓ Saved</span> : null}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Compliance & footer</CardTitle>
          <CardDescription>
            Used in built-in templates via {"{{organization_name}}"}, {"{{postal_address}}"}, and{" "}
            {"{{compliance_contact_email}}"} at send time. Applies account-wide to all broadcasts.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="compliance-org">Organization name</Label>
            <Input
              id="compliance-org"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="Acme Inc."
              autoComplete="organization"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-address">Physical postal address</Label>
            <Textarea
              id="compliance-address"
              value={postalAddress}
              onChange={(e) => setPostalAddress(e.target.value)}
              placeholder="123 Main St, City, ST 12345, Country"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Required for CAN-SPAM commercial email in the US.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="compliance-email">Compliance contact email</Label>
            <Input
              id="compliance-email"
              type="email"
              value={complianceContactEmail}
              onChange={(e) => setComplianceContactEmail(e.target.value)}
              placeholder="compliance@yourdomain.com"
              autoComplete="off"
            />
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button size="sm" onClick={() => void saveCompliance()} disabled={savingCompliance}>
            {savingCompliance ? "Saving…" : "Save compliance"}
          </Button>
          {complianceFlash ? (
            <span className="text-xs text-emerald-600">✓ Saved</span>
          ) : null}
        </CardFooter>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm">Archive</CardTitle>
          <CardDescription>
            Archiving cancels pending scheduled sends but preserves delivery history.
          </CardDescription>
        </CardHeader>
        <CardFooter className="items-center gap-2">
          {broadcast.listStatus === "archived" ? (
            <>
              <Badge variant="secondary" className="text-[10px]">
                Archived
              </Badge>
              <Button size="sm" variant="outline" onClick={() => void handleUnarchive()}>
                Reactivate
              </Button>
            </>
          ) : (
            <Button size="sm" variant="destructive" onClick={() => setArchiveOpen(true)}>
              Archive broadcast
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive &apos;{broadcast.name}&apos;?</DialogTitle>
            <DialogDescription>
              Pending scheduled sends will be cancelled, but delivery history is preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setArchiveOpen(false)} disabled={archiving}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void handleArchive()} disabled={archiving}>
              {archiving ? "Archiving…" : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(archiveBlocked)} onOpenChange={(open) => !open && setArchiveBlocked(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cannot archive broadcast</DialogTitle>
            <DialogDescription>{archiveBlocked}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setArchiveBlocked(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** @deprecated use BroadcastSettingsView */
export const CampaignSettingsView = BroadcastSettingsView;
