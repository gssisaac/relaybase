"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCampaignDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, CrmApiError } from "@/lib/crm/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CampaignSettingsView() {
  const { campaignId, campaign, templates, setCampaign } = useCampaignDetail();

  const [fromName, setFromName] = useState(campaign?.fromName ?? "");
  const [fromEmail, setFromEmail] = useState(campaign?.fromEmail ?? "");
  const [replyTo, setReplyTo] = useState(campaign?.replyTo ?? "");
  const [defaultTemplateId, setDefaultTemplateId] = useState(campaign?.defaultTemplateId ?? "");
  const [fromEmailError, setFromEmailError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [endpointUrl, setEndpointUrl] = useState(campaign?.dataSource?.endpointUrl ?? "");
  const [credential, setCredential] = useState("");
  const [credentialHeader, setCredentialHeader] = useState(campaign?.dataSource?.credentialHeader ?? "");
  const [cronEnabled, setCronEnabled] = useState(campaign?.dataSource?.cronEnabled ?? false);
  const [cronIntervalMinutes, setCronIntervalMinutes] = useState(
    campaign?.dataSource?.cronIntervalMinutes ?? 60,
  );
  const [savingDataSource, setSavingDataSource] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBlocked, setArchiveBlocked] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  if (!campaign) return null;

  async function saveIdentity() {
    if (fromEmail.trim() && !EMAIL_RE.test(fromEmail.trim())) {
      setFromEmailError("Enter a valid sender email (e.g., newsletter@yourdomain.com)");
      return;
    }
    setFromEmailError(null);
    setSavingIdentity(true);
    try {
      const updated = await crmApi.updateCampaign(campaignId, {
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim() || null,
        replyTo: replyTo.trim() || null,
        defaultTemplateId: defaultTemplateId || null,
      });
      setCampaign(updated);
      toast.success("Campaign settings saved successfully");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      if (err instanceof CrmApiError) setFromEmailError(err.message);
      else toast.error("Could not save settings");
    } finally {
      setSavingIdentity(false);
    }
  }

  async function saveDataSource() {
    setSavingDataSource(true);
    try {
      const updated = await crmApi.updateCampaign(campaignId, {
        dataSource: endpointUrl.trim()
          ? {
              endpointUrl: endpointUrl.trim(),
              credential: credential.trim() || undefined,
              credentialHeader: credentialHeader.trim() || undefined,
              cronEnabled,
              cronIntervalMinutes: Math.max(15, cronIntervalMinutes),
            }
          : null,
      });
      setCampaign(updated);
      setCredential("");
      toast.success("Data source saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save data source");
    } finally {
      setSavingDataSource(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const updated = await crmApi.archiveCampaign(campaignId);
      setCampaign(updated);
      setArchiveOpen(false);
      toast.success("Campaign archived");
    } catch (err) {
      if (err instanceof CrmApiError) {
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
      const updated = await crmApi.unarchiveCampaign(campaignId);
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
          Sender identity, defaults, and data source for this campaign.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sender identity</CardTitle>
          <CardDescription>Future broadcasts inherit these defaults automatically.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="from-name">From name</Label>
            <Input
              id="from-name"
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Engineering Team"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from-email">From email</Label>
            <Input
              id="from-email"
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="newsletter@yourdomain.com"
              autoComplete="off"
            />
            {fromEmailError ? <p className="text-xs text-destructive">{fromEmailError}</p> : null}
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
          <CardTitle className="text-sm">Data source</CardTitle>
          <CardDescription>
            Sync subscribers from a JSON endpoint (webhook, CSV pipeline, etc). Manage from the
            Subscribers tab with &quot;Sync now&quot;.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ds-url">Endpoint URL</Label>
            <Input
              id="ds-url"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://example.com/subscribers.json"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-credential">Credential (optional)</Label>
            <Input
              id="ds-credential"
              type="password"
              value={credential}
              onChange={(e) => setCredential(e.target.value)}
              placeholder={campaign.dataSource?.credential ? "••••••" : "token or API key"}
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ds-header">Credential header (optional)</Label>
            <Input
              id="ds-header"
              value={credentialHeader}
              onChange={(e) => setCredentialHeader(e.target.value)}
              placeholder="Authorization"
              autoComplete="off"
            />
          </div>
          <div className="flex items-center justify-between gap-2 sm:col-span-2">
            <div>
              <Label htmlFor="ds-cron">Auto-sync</Label>
              <p className="text-xs text-muted-foreground">Poll this endpoint on an interval.</p>
            </div>
            <Switch id="ds-cron" checked={cronEnabled} onCheckedChange={setCronEnabled} />
          </div>
          {cronEnabled ? (
            <div className="space-y-1.5">
              <Label htmlFor="ds-interval">Interval (minutes)</Label>
              <Input
                id="ds-interval"
                type="number"
                min={15}
                value={cronIntervalMinutes}
                onChange={(e) => setCronIntervalMinutes(Number(e.target.value) || 60)}
              />
            </div>
          ) : null}
          {campaign.dataSource?.lastSyncAt ? (
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Last sync {new Date(campaign.dataSource.lastSyncAt).toLocaleString()} ·{" "}
              {campaign.dataSource.lastSyncStatus === "error"
                ? `error: ${campaign.dataSource.lastSyncError}`
                : `${campaign.dataSource.lastSyncCount ?? 0} synced`}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button size="sm" variant="outline" onClick={() => void saveDataSource()} disabled={savingDataSource}>
            {savingDataSource ? "Saving…" : "Save data source"}
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-sm">Archive</CardTitle>
          <CardDescription>
            Archiving cancels pending scheduled broadcasts but preserves all subscriber and delivery
            history.
          </CardDescription>
        </CardHeader>
        <CardFooter className="items-center gap-2">
          {campaign.status === "archived" ? (
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
              Pending scheduled broadcasts will be cancelled, but all delivery history and subscriber
              records are preserved.
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
