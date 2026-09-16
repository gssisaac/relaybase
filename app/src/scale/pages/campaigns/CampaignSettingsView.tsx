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
import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { displayNameForAddress } from "@/scale/lib/use-domain-addresses";
import { domainOf } from "@/scale/lib/triggers/trigger-account-cmd-groups";
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
import { resolveEmailApiBase } from "@/lib/desktop/api";
import { ComplianceIdentityEditor } from "@/scale/components/ComplianceIdentityEditor";
import { scaleApi, ScaleApiError } from "@/lib/scale/api";

export function CampaignSettingsView() {
  const { campaignId, campaign, templates, setCampaign } = useCampaignDetail();
  const { availableAddresses, loading: addressesLoading, refreshAddresses } = useMailAccounts();

  const [sendDomain, setSendDomain] = useState<string | null>(null);

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
    void refreshAddresses();
  }, [refreshAddresses]);

  const audienceDomain = campaign?.audienceGroupDomain?.trim().toLowerCase() ?? null;

  const domainMismatch =
    Boolean(sendDomain && audienceDomain) && sendDomain!.toLowerCase() !== audienceDomain;

  const domainLocked = campaign?.status !== "draft";

  const nameOptions = useMemo(() => {
    const d = sendDomain?.trim().toLowerCase();
    const names = new Set<string>();
    if (fromName?.trim()) names.add(fromName.trim());
    if (d) {
      for (const address of sortAddressesByLocalPart(availableAddresses)) {
        if (domainOf(address.email, address.domain) !== d) continue;
        names.add(displayNameForAddress(address));
      }
    }
    return [...names];
  }, [availableAddresses, fromName, sendDomain]);

  const allowedEmails = useMemo(
    () => new Set(availableAddresses.map((a) => a.email.toLowerCase())),
    [availableAddresses],
  );

  if (!campaign) return null;

  async function saveIdentity() {
    const resolvedDomain =
      sendDomain?.trim().toLowerCase() ||
      (fromEmail?.includes("@") ? fromEmail.slice(fromEmail.indexOf("@") + 1).toLowerCase() : "");
    if (!resolvedDomain) {
      setFromEmailError("Select a sender account");
      return;
    }
    if (audienceDomain && resolvedDomain !== audienceDomain) {
      setFromEmailError(
        `Subscriber group is on ${campaign?.audienceGroupDomain}. Pick a sender on that domain.`,
      );
      return;
    }
    if (fromEmail && !allowedEmails.has(fromEmail.toLowerCase())) {
      setFromEmailError("Select a sender address from your Console accounts");
      return;
    }
    setFromEmailError(null);
    setSavingIdentity(true);
    try {
      const workerUrl = resolveEmailApiBase();
      const updated = await scaleApi.updateCampaign(campaignId, {
        domain: resolvedDomain,
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
          <CardTitle className="text-sm">Subscriber group</CardTitle>
          <CardDescription>
            Contacts and data sources are managed in Subscribers. Send eligibility is on the Subscribers tab.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {campaign.audienceGroupName ?? "No subscriber group linked"}
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
              Open subscribers
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
            <Label htmlFor="from-email">Sender account</Label>
            <AccountCmdDropdown
              triggerId="from-email"
              triggerClassName="min-w-0"
              value={fromEmail}
              domainFilter={audienceDomain}
              pinnedEmails={fromEmail ? [fromEmail] : []}
              disabled={domainLocked || addressesLoading}
              onValueChange={(email, ctx) => {
                if (!email) {
                  setFromEmail(null);
                  setFromName(null);
                  return;
                }
                setFromEmail(email);
                if (ctx?.domain) setSendDomain(ctx.domain);
                if (ctx?.address) setFromName(displayNameForAddress(ctx.address));
              }}
            />
            {domainLocked ? (
              <p className="text-xs text-muted-foreground">
                Sender can only be changed while the campaign is a draft (current status:{" "}
                {campaign.status}).
              </p>
            ) : audienceDomain ? (
              <p className="text-xs text-muted-foreground">
                Sending domain is set from the account you pick (must match audience on{" "}
                {campaign.audienceGroupDomain}).
              </p>
            ) : sendDomain ? (
              <p className="text-xs text-muted-foreground">Sending domain: {sendDomain}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pick a Console account — domain is inferred from the address.
              </p>
            )}
            {domainMismatch ? (
              <p className="text-xs text-destructive">
                Subscriber group is on {campaign.audienceGroupDomain}. Pick a sender on that domain.
              </p>
            ) : null}
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
              Display name for {fromEmail ?? "the selected sender"}.
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
