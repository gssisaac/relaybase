"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { crmApi, CrmApiError, type Activity, type Contact } from "@/lib/crm/api";

function activityLabel(activity: Activity): string {
  const payload = activity.payload as Record<string, unknown> | null;
  if (payload && "stageChange" in payload) {
    const change = payload.stageChange as { from: string; to: string };
    return `Stage changed: ${change.from} → ${change.to}`;
  }
  if (payload && "note" in payload) return `Note: ${payload.note}`;
  return activity.type;
}

export function ContactDetailSheet({
  contactId,
  onClose,
  onDeleted,
}: {
  contactId: string | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!contactId) return;
    setLoading(true);
    setDeleteError(null);
    crmApi
      .getContact(contactId)
      .then((data) => {
        setContact(data.contact);
        setActivities(data.activities);
      })
      .catch(() => toast.error("Could not load contact"))
      .finally(() => setLoading(false));
  }, [contactId]);

  async function handleDelete() {
    if (!contact) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await crmApi.deleteContact(contact.id);
      toast.success("Deleted");
      setConfirmDelete(false);
      onDeleted(contact.id);
      onClose();
    } catch (err) {
      if (err instanceof CrmApiError && err.status === 409) {
        setDeleteError(err.message);
      } else {
        toast.error("Could not delete contact");
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function toggleSnooze() {
    if (!contact) return;
    const next = !contact.followupSnoozed;
    try {
      const updated = await crmApi.updateContact(contact.id, { followupSnoozed: next });
      setContact(updated);
    } catch {
      toast.error("Could not update reminder");
    }
  }

  return (
    <>
      <Sheet open={Boolean(contactId)} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{contact?.name || contact?.email || "Contact"}</SheetTitle>
            <SheetDescription>{contact?.email}</SheetDescription>
          </SheetHeader>

          {loading || !contact ? (
            <div className="p-4 text-sm text-muted-foreground">Loading…</div>
          ) : (
            <Tabs defaultValue="profile" className="mt-2 flex-1 px-4">
              <TabsList>
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="profile" className="space-y-4 py-4">
                {contact.source === "audience_migration" ? (
                  <Badge variant="outline">Migrated from Audience · {contact.createdAt.slice(0, 10)}</Badge>
                ) : null}
                <div className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {contact.tags.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No tags</span>
                  ) : null}
                </div>
                <div className="text-sm text-muted-foreground">Status: {contact.status}</div>
                <div className="text-sm text-muted-foreground">
                  Last sent: {contact.lastActivityAt ? new Date(contact.lastActivityAt).toLocaleString() : "never"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Last reply: {contact.lastReplyAt ? new Date(contact.lastReplyAt).toLocaleString() : "never"}
                </div>
                <div className="flex items-center justify-between rounded-md border border-border/60 p-3">
                  <div>
                    <p className="text-sm font-medium">Follow-up reminder</p>
                    {contact.followupSnoozed ? (
                      <p className="text-xs text-muted-foreground">
                        Reminder off —{" "}
                        <button className="underline" onClick={() => void toggleSnooze()}>
                          turn back on
                        </button>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Active</p>
                    )}
                  </div>
                  {!contact.followupSnoozed ? (
                    <Button variant="ghost" size="sm" onClick={() => void toggleSnooze()}>
                      Ignore
                    </Button>
                  ) : null}
                </div>
                {deleteError ? <p className="text-xs text-destructive">{deleteError}</p> : null}
                <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                  Delete contact
                </Button>
              </TabsContent>
              <TabsContent value="timeline" className="space-y-3 py-4">
                {activities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  activities.map((activity) => (
                    <div key={activity.id} className="border-b border-border/40 pb-2 text-sm">
                      <p>{activityLabel(activity)}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(activity.occurredAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              Deleting this contact also deletes pipeline and timeline records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={deleting} onClick={() => void handleDelete()}>
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
