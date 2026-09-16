"use client";

import { MoreHorizontal, Plus, Upload, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useVerifiedAccounts } from "@/lib/scale/VerifiedAccountsContext";
import {
  clearAudienceGroupDetailCache,
  useAudienceGroupDetail,
} from "@/scale/pages/audience/AudienceGroupDetailContext";
import { audienceContactDisplayName } from "@/lib/audience-display";
import { ScaleApiError, scaleAudienceApi } from "@/lib/scale/audience-api";
import { ImportSubscribersDialog } from "@/scale/components/audience/ImportSubscribersDialog";
import { AddVerifiedAccountDialog } from "@/scale/components/verified-accounts/AddVerifiedAccountDialog";
import { VerificationPendingDialog } from "@/scale/components/verified-accounts/VerificationPendingDialog";
import { VerificationStatusBadge } from "@/scale/components/verified-accounts/VerificationStatusBadge";
import { VerifiedAccountsQuotaCard } from "@/scale/components/verified-accounts/VerifiedAccountsQuotaCard";

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
  if (e instanceof ScaleApiError) return e.message;
  if (e instanceof Error) return e.message;
  return fallback;
}

export function AudienceGroupContactsView() {
  const { groupId, detail, refresh } = useAudienceGroupDetail();
  const verifiedStore = useVerifiedAccounts();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [unsubConfirm, setUnsubConfirm] = useState<{ contactId: string; email: string } | null>(
    null,
  );
  const [unsubSubmitting, setUnsubSubmitting] = useState(false);

  const contacts = detail?.contacts ?? [];
  const group = detail?.group;

  const verificationCounts = useMemo(
    () => verifiedStore.countsForEmails(contacts.map((c) => c.email)),
    [contacts, verifiedStore, verifiedStore.lastRefreshedAt],
  );

  useEffect(() => {
    for (const c of contacts) {
      const status = verifiedStore.statusForEmail(c.email);
      if (status === "pending") {
        verifiedStore.startPolling(c.email, () => {
          void refresh(true);
        });
      }
    }
  }, [contacts, verifiedStore, refresh]);

  if (!detail || !group) return null;

  async function setSendStatus(
    contactId: string,
    sendStatus: "active" | "unsubscribed",
    email: string,
  ) {
    try {
      await scaleAudienceApi.updateContactSendStatus(groupId, contactId, sendStatus);
      toast.success(
        sendStatus === "unsubscribed"
          ? `${email} marked unsubscribed`
          : `${email} resubscribed`,
      );
      clearAudienceGroupDetailCache("", groupId);
      await refresh(true);
    } catch (e) {
      toast.error(friendlyCrmError(e, "Failed to update account"));
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
      await scaleAudienceApi.removeContact(groupId, contactId);
      toast.success(`Removed ${email}`);
      clearAudienceGroupDetailCache("", groupId);
      await refresh(true);
    } catch (e) {
      toast.error(friendlyCrmError(e, "Failed to remove account"));
    }
  }

  async function startVerification(email: string) {
    try {
      const status = await verifiedStore.requestCloudflareVerification(email);
      if (status === "verified") {
        toast.success(`${email} is verified`);
      } else {
        setPendingEmail(email);
        setPendingOpen(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start verification");
    }
  }

  return (
    <div className="space-y-4">
      <VerifiedAccountsQuotaCard />

      {verifiedStore.destinationError ? (
        <p className="text-xs text-destructive">{verifiedStore.destinationError}</p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Subscribers</h2>
          <p className="text-xs text-muted-foreground">
            {verificationCounts.verified} of {verificationCounts.total} verified with Cloudflare.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportSubscribersDialog
            groupId={groupId}
            onImported={() => {
              clearAudienceGroupDetailCache("", groupId);
              void refresh(true);
            }}
            trigger={
              <Button size="sm" variant="outline">
                <Upload className="size-4" />
                Import
              </Button>
            }
          />
          <AddVerifiedAccountDialog
            groupId={groupId}
            onAdded={() => {
              clearAudienceGroupDetailCache("", groupId);
              void refresh(true);
            }}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Add verified account
              </Button>
            }
          />
        </div>
      </div>

      {contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Users className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No accounts yet</p>
            <p className="text-xs text-muted-foreground">
              Add a verified account to start sending without daily quota limits.
            </p>
            <AddVerifiedAccountDialog
              groupId={groupId}
              onAdded={() => {
                clearAudienceGroupDetailCache("", groupId);
                void refresh(true);
              }}
              trigger={
                <Button size="sm" className="mt-2">
                  Add verified account
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {contacts.map((c) => {
              const verification = verifiedStore.statusForEmail(c.email);
              return (
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
                  <div className="flex shrink-0 items-center gap-2">
                    <VerificationStatusBadge status={verification} />
                    <SendStatusBadge status={c.sendStatus ?? "active"} />
                    {verification !== "verified" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          if (verification === "pending") {
                            setPendingEmail(c.email);
                            setPendingOpen(true);
                          } else {
                            void startVerification(c.email);
                          }
                        }}
                      >
                        {verification === "pending" ? "Pending…" : "Verify"}
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            aria-label={`More actions for ${c.email}`}
                          />
                        }
                      >
                        <MoreHorizontal className="size-3.5" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        {(c.sendStatus ?? "active") === "active" ? (
                          <DropdownMenuItem
                            onClick={() =>
                              setUnsubConfirm({ contactId: c.id, email: c.email })
                            }
                          >
                            Unsubscribe
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => void setSendStatus(c.id, "active", c.email)}
                          >
                            Resubscribe
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => void removeContact(c.id, c.email)}
                        >
                          Remove from group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <VerificationPendingDialog
        email={pendingEmail}
        open={pendingOpen}
        onOpenChange={setPendingOpen}
        onVerified={() => {
          clearAudienceGroupDetailCache("", groupId);
          void refresh(true);
        }}
      />

      <Dialog open={Boolean(unsubConfirm)} onOpenChange={(open) => !open && setUnsubConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsubscribe this account?</DialogTitle>
            <DialogDescription>
              {unsubConfirm ? (
                <>
                  <span className="font-medium text-foreground">{unsubConfirm.email}</span> will be
                  marked unsubscribed for this group. They will be excluded from future newsletters
                  linked here.
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
