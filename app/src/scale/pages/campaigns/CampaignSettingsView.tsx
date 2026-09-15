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
import { CmdDropdown } from "@/components/ui/cmd-dropdown";
import {
  displayNameForAddress,
  useDomainAddresses,
} from "@/scale/lib/use-domain-addresses";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

import { scaleAudienceDetailHref } from "@/scale/lib/paths";
import { useCampaignDetail } from "@/scale/pages/campaigns/CampaignDetailContext";
import { useWorkerDomains } from "@/scale/lib/use-worker-domains";
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { ComplianceIdentityEditor } from "@/scale/components/ComplianceIdentityEditor";
import { scaleApi, ScaleApiError } from "@/lib/scale/api";

export function CampaignSettingsView() {
  const { campaignId, campaign, templates, setCampaign } = useCampaignDetail();
  const { readyDomainNames, loading: domainsLoading, refresh: refreshWorkerDomains } =
    useWorkerDomains();

  const [sendDomain, setSendDomain] = useState<string | null>(null);
  const { domainAddresses, displayNameOptions, loading: addressesLoading } =
    useDomainAddresses(sendDomain);

  const [fromName, setFromName] = useState<string | null>(campaign?.fromName ?? null);
  const [fromEmail, setFromEmail] = useState<string | null>(campaign?.fromEmail ?? null);
  const [replyTo, setReplyTo] = useState(campaign?.replyTo ?? "");
  const [defaultLayoutId, setDefaultTemplateId] = useState(campaign?.defaultLayoutId ?? "");
  const [fromEmailError, setFromEmailError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBlocked, setArchiveBlocked] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [defaultComplianceIdentityId, setDefaultComplianceIdentityId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!campaign) return;
    setFromName(campaign.fromName ?? null);
    setFromEmail(campaign.fromEmail ?? null);
    setSendDomain(campaign.domain ?? campaign.audienceGroupDomain ?? null);
  }, [campaign]);

  useEffect(() => {
    scaleApi
      .getAccountLink()
      .then((link) => {
        setDefaultComplianceIdentityId(link.defaultComplianceIdentityId ?? null);
      })
      .catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    void refreshWorkerDomains();
  }, [refreshWorkerDomains]);

  const domainOptionValues = useMemo(() => {
    const values = new Set(readyDomainNames);
    const pinned = (sendDomain ?? campaign?.domain ?? campaign?.audienceGroupDomain)?.trim();
    if (pinned) values.add(pinned);
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [readyDomainNames, sendDomain, campaign?.domain, campaign?.audienceGroupDomain]);

  const domainMismatch =
    Boolean(sendDomain && campaign?.audienceGroupDomain) &&
    sendDomain!.toLowerCase() !== campaign!.audienceGroupDomain!.toLowerCase();

  const domainLocked = campaign?.status !== "draft";
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

  const domainSelectOptions = useMemo(
    () => domainOptionValues.map((d) => ({ value: d, label: d })),
    [domainOptionValues],
  );

  const accountEmailOptions = useMemo(
    () => emailOptions.map((email) => ({ value: email, label: email })),
    [emailOptions],
  );

  const domainPlaceholder =
    domainsLoading && domainOptionValues.length === 0
      ? "Loading domains…"
      : domainOptionValues.length === 0
        ? "No domains in Console"
        : "Select sending domain";

  const fromEmailPlaceholder =
    addressesLoading
      ? "Loading accounts…"
      : emailOptions.length === 0
        ? "No senders on this domain"
        : "Select sender address";

  if (!campaign) return null;

  async function saveIdentity() {
    if (!sendDomain) {
      setFromEmailError("Select a sending domain");
      return;
    }
    if (domainMismatch) {
      setFromEmailError(
        `Audience is on ${campaign?.audienceGroupDomain}. Match that domain or change the linked audience.`,
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
      const updated = await scaleApi.updateCampaign(campaignId, {
        domain: sendDomain,
        ...(workerUrl ? { workerUrl } : {}),
        fromName: fromName?.trim() || null,
        fromEmail: fromEmail?.trim() || null,
        replyTo: replyTo.trim() || null,
        defaultLayoutId: defaultLayoutId || null,
      });
      setCampaign(updated);
      toast.success("Campaign settings saved");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      if (err instanceof ScaleApiError) setFromEmailError(err.message);
      else toast.error("Could not save settings");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const updated = await scaleApi.archiveCampaign(campaignId);
      setCampaign(updated);
      setArchiveOpen(false);
      toast.success("Campaign archived");
    } catch (err) {
      if (err instanceof ScaleApiError) {
        setArchiveOpen(false);
        setArchiveBlocked(err.message);
      } else {
        toast.error("Could not archive campaign");
      }
    } finally {
      setArchiving(false);
    }
  }

  async function handleUnarchive() {
    try {
      const updated = await scaleApi.unarchiveCampaign(campaignId);
      setCampaign(updated);
      toast.success("Campaign reactivated");
    } catch {
      toast.error("Could not reactivate campaign");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Settings</h2>
        <p className="text-xs text-muted-foreground">
          Sender identity and defaults for this campaign.
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
              {campaign.audienceGroupName ?? "No audience linked"}
            </p>
            {campaign.audienceGroupDomain ? (
              <p className="truncate text-xs text-muted-foreground">{campaign.audienceGroupDomain}</p>
            ) : null}
          </div>
          {campaign.audienceGroupId ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link href={scaleAudienceDetailHref(campaign.audienceGroupId)} />}
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
            <CmdDropdown
              triggerId="send-domain"
              triggerClassName="min-w-0"
              value={sendDomain}
              placeholder={domainPlaceholder}
              searchPlaceholder="Search domains…"
              options={domainSelectOptions}
              disabled={domainSelectDisabled}
              onValueChange={(next) => {
                if (!next) {
                  setSendDomain(null);
                  return;
                }
                setSendDomain(next);
                setFromEmail(null);
                setFromName(null);
              }}
            />
            {domainLocked ? (
              <p className="text-xs text-muted-foreground">
                Domain can only be changed while the campaign is a draft (current status:{" "}
                {campaign.status}). Duplicate the campaign to pick a different domain.
              </p>
            ) : domainsLoading ? (
              <p className="text-xs text-muted-foreground">Loading domains from Worker…</p>
            ) : domainOptionValues.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No domains on your Worker — add one in Console → Domains.
              </p>
            ) : domainMismatch ? (
              <p className="text-xs text-destructive">
                Audience is on {campaign.audienceGroupDomain}. Pick that domain to send.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Same Worker domain catalog as when you create a campaign.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from-email">From email</Label>
            <CmdDropdown
              triggerId="from-email"
              triggerClassName="min-w-0"
              value={fromEmail}
              placeholder={fromEmailPlaceholder}
              searchPlaceholder="Search accounts…"
              options={accountEmailOptions}
              disabled={addressesLoading || emailOptions.length === 0}
              onValueChange={(email) => {
                if (!email) {
                  setFromEmail(null);
                  return;
                }
                setFromEmail(email);
                const match = domainAddresses.find((a) => a.email === email);
                if (match) setFromName(displayNameForAddress(match));
              }}
            />
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
              value={defaultLayoutId || null}
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
            Reusable sender records fill the built-in footer at send time. New campaigns use the
            default unless you pick another on Content → Variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ComplianceIdentityEditor
            mode="account-default"
            selectedIdentityId={defaultComplianceIdentityId}
            accountDefaultIdentityId={defaultComplianceIdentityId}
            description="Organization, postal address, and compliance contact are shared with the template footer — not separate merge tags."
            onSelectedIdentityIdChange={async (id) => {
              if (!id) return;
              try {
                const link = await scaleApi.updateAccountLink({
                  defaultComplianceIdentityId: id,
                });
                setDefaultComplianceIdentityId(link.defaultComplianceIdentityId ?? id);
                toast.success("Default compliance sender updated");
              } catch (err) {
                toast.error(
                  err instanceof ScaleApiError ? err.message : "Could not update default sender",
                );
              }
            }}
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm">Archive</CardTitle>
          <CardDescription>
            Archiving cancels pending scheduled sends but preserves delivery history.
          </CardDescription>
        </CardHeader>
        <CardFooter className="items-center gap-2">
          {campaign.listStatus === "archived" ? (
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
              Archive campaign
            </Button>
          )}
        </CardFooter>
      </Card>

      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Archive &apos;{campaign.name}&apos;?</DialogTitle>
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
            <DialogTitle>Cannot archive campaign</DialogTitle>
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
