"use client";

import { Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearAudienceGroupDetailCache,
  useAudienceGroupDetail,
} from "@/crm/pages/audience/AudienceGroupDetailContext";
import { audienceContactDisplayName } from "@/lib/audience-display";
import { CrmApiError, crmAudienceApi } from "@/lib/crm/audience-api";

import { cn } from "@/lib/utils";

const SEND_STATUS_STYLE = {
  active: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  unsubscribed: "border-border bg-muted text-muted-foreground",
} as const;

function SendStatusBadge({ status }: { status: "active" | "unsubscribed" }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] capitalize", SEND_STATUS_STYLE[status])}
    >
      {status === "active" ? "subscribed" : status}
    </Badge>
  );
}

function friendlyCrmError(e: unknown, fallback: string): string {
  if (e instanceof CrmApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

export function AudienceGroupContactsView() {
  const { groupId, detail, refresh } = useAudienceGroupDetail();
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactEmail, setContactEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [unsubConfirm, setUnsubConfirm] = useState<{ contactId: string; email: string } | null>(
    null,
  );
  const [unsubSubmitting, setUnsubSubmitting] = useState(false);

  if (!detail) return null;

  const contacts = detail.contacts;
  const group = detail.group;

  async function addContact() {
    setSaving(true);
    try {
      const data = await crmAudienceApi.addContact(groupId, {
        email: contactEmail,
        name: contactName || undefined,
      });
      setContactEmail("");
      setContactName("");
      setAddOpen(false);
      toast.success(`Added ${data.contact.email}`);
      clearAudienceGroupDetailCache("", groupId);
      await refresh(true);
    } catch (e) {
      toast.error(friendlyCrmError(e, "Failed to add contact"));
    } finally {
      setSaving(false);
    }
  }

  async function setSendStatus(contactId: string, sendStatus: "active" | "unsubscribed", email: string) {
    try {
      await crmAudienceApi.updateContactSendStatus(groupId, contactId, sendStatus);
      toast.success(
        sendStatus === "unsubscribed"
          ? `${email} marked unsubscribed`
          : `${email} resubscribed`,
      );
      clearAudienceGroupDetailCache("", groupId);
      await refresh(true);
    } catch (e) {
      toast.error(friendlyCrmError(e, "Failed to update contact"));
    }
  }

  async function confirmUnsubscribe() {
    if (!unsubConfirm) return;
    setUnsubSubmitting(true);
    try {
      await setSendStatus(unsubConfirm.contactId, "unsubscribed", unsubConfirm.email);
      setUnsubConfirm(null);
    } finally {
      setUnsubSubmitting(false);
    }
  }

  async function removeContact(contactId: string, email: string) {
    try {
      await crmAudienceApi.removeContact(groupId, contactId);
      toast.success(`Removed ${email}`);
      clearAudienceGroupDetailCache("", groupId);
      await refresh(true);
    } catch (e) {
      toast.error(friendlyCrmError(e, "Failed to remove contact"));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Audience group</CardTitle>
          <CardDescription>
            Contacts live here. Unsubscribe status is shared with linked broadcasts — remove
            deletes the contact entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{group.domain}</p>
            <p className="truncate text-xs text-muted-foreground">
              {contacts.length.toLocaleString()} contact{contacts.length === 1 ? "" : "s"}
              {group.dataSource
                ? group.cronEnabled
                  ? " · Synced · scheduled"
                  : " · Synced"
                : " · Manual"}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Contacts</h2>
          <p className="text-xs text-muted-foreground">
            {contacts.length.toLocaleString()} contact{contacts.length === 1 ? "" : "s"}.
          </p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setContactEmail("");
              setContactName("");
            }
          }}
        >
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" />
            Add contact
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name (optional)</Label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                size="sm"
                disabled={saving || !contactEmail.trim()}
                onClick={() => void addContact()}
              >
                {saving ? "Adding…" : "Add"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No contacts yet</p>
            <p className="text-xs text-muted-foreground">
              Add contacts manually, or sync a data source from Settings.
            </p>
            <Button size="sm" className="mt-2" onClick={() => setAddOpen(true)}>
              Add contact
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {contacts.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {audienceContactDisplayName(c.email, c.name)}
                  </p>
                  {c.name ? (
                    <p className="truncate text-xs text-muted-foreground">{c.email}</p>
                  ) : null}
                </div>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {c.source}
                </Badge>
                <SendStatusBadge status={c.sendStatus ?? "active"} />
                <div className="flex shrink-0 items-center gap-1">
                  {(c.sendStatus ?? "active") === "active" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => setUnsubConfirm({ contactId: c.id, email: c.email })}
                    >
                      Unsubscribe
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => void setSendStatus(c.id, "active", c.email)}
                    >
                      Resubscribe
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => void removeContact(c.id, c.email)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={Boolean(unsubConfirm)} onOpenChange={(open) => !open && setUnsubConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsubscribe this contact?</DialogTitle>
            <DialogDescription>
              {unsubConfirm ? (
                <>
                  <span className="font-medium text-foreground">{unsubConfirm.email}</span> will be
                  marked unsubscribed for this audience group. They will be excluded from future
                  broadcasts linked to this group. This does not delete the contact — use Remove if
                  you want them off the list entirely.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUnsubConfirm(null)}
              disabled={unsubSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void confirmUnsubscribe()}
              disabled={unsubSubmitting}
            >
              {unsubSubmitting ? "Updating…" : "Confirm unsubscribe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
