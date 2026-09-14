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
import Link from "next/link";

import { crmAudienceDetailHref } from "@/crm/lib/paths";
import { useBroadcastDetail } from "@/crm/pages/campaigns/CampaignDetailContext";
import { crmApi, CrmApiError } from "@/lib/crm/api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function BroadcastSettingsView() {
  const { broadcastId, broadcast, templates, setBroadcast } = useBroadcastDetail();

  const [fromName, setFromName] = useState(broadcast?.fromName ?? "");
  const [fromEmail, setFromEmail] = useState(broadcast?.fromEmail ?? "");
  const [replyTo, setReplyTo] = useState(broadcast?.replyTo ?? "");
  const [defaultTemplateId, setDefaultTemplateId] = useState(broadcast?.defaultTemplateId ?? "");
  const [fromEmailError, setFromEmailError] = useState<string | null>(null);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveBlocked, setArchiveBlocked] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  if (!broadcast) return null;

  async function saveIdentity() {
    if (fromEmail.trim() && !EMAIL_RE.test(fromEmail.trim())) {
      setFromEmailError("Enter a valid sender email (e.g., newsletter@yourdomain.com)");
      return;
    }
    setFromEmailError(null);
    setSavingIdentity(true);
    try {
      const updated = await crmApi.updateBroadcast(broadcastId, {
        fromName: fromName.trim() || null,
        fromEmail: fromEmail.trim() || null,
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
