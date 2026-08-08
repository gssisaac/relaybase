"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Address } from "./types";

export function ComposeForm({
  sendFrom,
  addresses,
  sendTo,
  setSendTo,
  sendCc,
  setSendCc,
  sendSubject,
  setSendSubject,
  sendText,
  setSendText,
  sending,
  onSend,
}: {
  sendFrom: string;
  addresses: Address[];
  sendTo: string;
  setSendTo: (v: string) => void;
  sendCc: string;
  setSendCc: (v: string) => void;
  sendSubject: string;
  setSendSubject: (v: string) => void;
  sendText: string;
  setSendText: (v: string) => void;
  sending: boolean;
  onSend: () => void;
}) {
  const selected = addresses.find((a) => a.email === sendFrom);
  const displayName = selected?.displayName?.trim();
  const fromLabel = displayName
    ? `${displayName} <${sendFrom}>`
    : sendFrom || "Select an account from the sidebar";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="grid shrink-0 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">From</Label>
          <div className="flex h-10 items-center rounded-lg border border-border bg-muted/30 px-3 text-sm">
            <span className="truncate">{fromLabel}</span>
          </div>
          {displayName ? (
            <p className="text-xs text-muted-foreground">
              Recipients will see: {displayName}
            </p>
          ) : sendFrom ? (
            <p className="text-xs text-muted-foreground">
              No display name set — edit this account under Accounts.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Choose Compose under an account in the sidebar.
            </p>
          )}
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">To</Label>
          <Input
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="one@example.com, two@example.com"
            className="h-10"
          />
          <p className="text-xs text-muted-foreground">
            Separate multiple addresses with commas.
          </p>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Cc</Label>
          <Input
            value={sendCc}
            onChange={(e) => setSendCc(e.target.value)}
            placeholder="cc@example.com, team@example.com"
            className="h-10"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="text-xs">Subject</Label>
          <Input
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1.5">
        <Label className="shrink-0 text-xs">Message</Label>
        <Textarea
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          className="min-h-0 flex-1 resize-none overflow-y-auto"
          style={{ fieldSizing: "fixed" }}
        />
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t border-border pt-4">
        <Button
          size="sm"
          onClick={onSend}
          disabled={sending || !sendFrom || !sendTo.trim() || !sendSubject}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
