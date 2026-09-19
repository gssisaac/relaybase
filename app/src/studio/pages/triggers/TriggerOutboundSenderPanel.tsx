"use client";

import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AccountCmdDropdown } from "@/components/AccountCmdDropdown";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMailAccounts } from "@/email/components/accounts/MailAccountsContext";
import { sortAddressesByLocalPart } from "@/email/lib/accounts/enabled-accounts";
import { resolveTriggerSendingDomain } from "@/studio/lib/triggers/trigger-sending-domain";
import { displayNameForAddress } from "@/studio/lib/domains/use-domain-addresses";
import { useTriggerDetail } from "@/studio/pages/triggers/TriggerDetailContext";
import { studioApi, StudioApiError } from "@/studio/api";

export type OutboundSenderDraft = {
  fromName: string | null;
  fromEmail: string | null;
  replyTo: string | null;
};

export function TriggerOutboundSenderPanel({
  draft,
  onDraftChange,
  disabled,
  embedded,
}: {
  draft: OutboundSenderDraft;
  onDraftChange: (patch: Partial<OutboundSenderDraft>) => void;
  disabled?: boolean;
  /** Full-height inspector column inside Config (no fixed aside width). */
  embedded?: boolean;
}) {
  const { triggerId, trigger, setTrigger } = useTriggerDetail();
  const {
    availableAddresses,
    loading: addressesLoading,
    error: addressesError,
    refreshAddresses,
  } = useMailAccounts();
  const [saving, setSaving] = useState(false);
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [useReplyTo, setUseReplyTo] = useState(false);

  const { fromName, fromEmail, replyTo } = draft;

  useEffect(() => {
    setUseReplyTo(false);
  }, [triggerId]);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  const senderCandidates = useMemo(
    () => sortAddressesByLocalPart(availableAddresses),
    [availableAddresses],
  );

  const pinnedSenderEmails = useMemo(
    () => [fromEmail ?? "", useReplyTo ? (replyTo ?? "") : ""].filter(Boolean),
    [fromEmail, replyTo, useReplyTo],
  );

  const allowedSenderEmails = useMemo(
    () => new Set(senderCandidates.map((a) => a.email.toLowerCase())),
    [senderCandidates],
  );

  const fromEmailValue = fromEmail?.trim().toLowerCase() || null;
  const replyToValue = replyTo?.trim().toLowerCase() || null;

  async function saveSender() {
    if (!trigger) return;
    const sendDomain = resolveTriggerSendingDomain(trigger, fromEmail);
    if (!sendDomain) {
      setIdentityError("Select a from address so we can resolve the sending domain");
      return;
    }
    if (fromEmail && !allowedSenderEmails.has(fromEmail.toLowerCase())) {
      setIdentityError("Select a sender address from your Console accounts");
      return;
    }
    const replyToToSave = useReplyTo ? replyTo?.trim() || null : null;
    if (useReplyTo && !replyToToSave) {
      setIdentityError("Select a Reply-To address or turn off custom Reply-To");
      return;
    }
    if (replyToToSave && !allowedSenderEmails.has(replyToToSave.toLowerCase())) {
      setIdentityError("Select a reply-to address from your Console accounts");
      return;
    }
    setIdentityError(null);
    setSaving(true);
    try {
      const updated = await studioApi.updateTrigger(triggerId, {
        domain: sendDomain,
        fromName: fromName?.trim() || null,
        fromEmail: fromEmail?.trim() || null,
        replyTo: replyToToSave,
      });
      setTrigger(updated);
      toast.success("Sender saved");
    } catch (e) {
      toast.error(e instanceof StudioApiError ? e.message : "Could not save sender");
    } finally {
      setSaving(false);
    }
  }

  const shellClass = embedded
    ? "flex min-h-0 min-w-0 flex-1 flex-col bg-background"
    : "flex w-[min(100%,20rem)] shrink-0 flex-col border-l border-border bg-background";

  const Shell = embedded ? "div" : "aside";

  return (
    <Shell className={shellClass}>
      <div className={embedded ? "shrink-0 px-4 py-3" : "border-b border-border px-4 py-3"}>
        <h2 className="text-sm font-semibold text-foreground">Outbound sender</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          From name and address on emails this trigger sends.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {addressesError ? <p className="text-sm text-destructive">{addressesError}</p> : null}
        <div className="space-y-2">
          <Label htmlFor="preview-from-email">From email</Label>
          <AccountCmdDropdown
            triggerId="preview-from-email"
            triggerClassName="min-w-0"
            addresses={senderCandidates}
            autoRefresh={false}
            pinnedEmails={pinnedSenderEmails}
            value={fromEmailValue}
            disabled={disabled || addressesLoading}
            onValueChange={(email, ctx) => {
              if (!email) {
                onDraftChange({ fromEmail: null, fromName: null });
                return;
              }
              onDraftChange({
                fromEmail: email,
                fromName: ctx?.address ? displayNameForAddress(ctx.address) : null,
              });
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="preview-from-name">From name</Label>
          <Input
            id="preview-from-name"
            value={fromName ?? ""}
            disabled={disabled}
            placeholder="Display name on sent mail"
            onChange={(e) => onDraftChange({ fromName: e.target.value || null })}
          />
          <p className="text-xs text-muted-foreground">
            Filled from Accounts when you change From email; you can edit it here.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex gap-2.5">
            <Checkbox
              id="preview-use-reply-to"
              checked={useReplyTo}
              disabled={disabled}
              onCheckedChange={(value) => {
                const on = value === true;
                setUseReplyTo(on);
                if (!on) onDraftChange({ replyTo: null });
              }}
              className="mt-0.5"
            />
            <div className="flex min-w-0 items-center gap-1">
              <Label htmlFor="preview-use-reply-to" className="text-sm font-normal leading-snug">
                Use custom Reply-To
              </Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="size-6 shrink-0 text-muted-foreground"
                      aria-label="About Reply-To"
                      onClick={(e) => e.stopPropagation()}
                    />
                  }
                >
                  <Info className="size-3.5" aria-hidden />
                </PopoverTrigger>
                <PopoverContent align="start" side="top" className="text-xs text-muted-foreground">
                  Replies go to the From address unless you turn this on to route them to another
                  inbox.
                </PopoverContent>
              </Popover>
            </div>
          </div>
          {useReplyTo ? (
            <div className="space-y-2">
              <Label htmlFor="preview-reply-to">Reply-To</Label>
              <AccountCmdDropdown
                triggerId="preview-reply-to"
                triggerClassName="min-w-0"
                addresses={senderCandidates}
                autoRefresh={false}
                pinnedEmails={pinnedSenderEmails}
                value={replyToValue}
                disabled={disabled || addressesLoading}
                onValueChange={(email) => onDraftChange({ replyTo: email ?? null })}
              />
            </div>
          ) : null}
        </div>
        {identityError ? <p className="text-xs text-destructive">{identityError}</p> : null}
        <p className="text-xs text-muted-foreground">
          Compliance footer identity is edited in the message editor (Edit on the template node).
        </p>
        {!disabled ? (
          <Button className="w-full" onClick={() => void saveSender()} disabled={saving}>
            {saving ? "Saving…" : "Save sender"}
          </Button>
        ) : null}
      </div>
    </Shell>
  );
}
