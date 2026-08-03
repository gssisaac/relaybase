"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import type { Address } from "./types";

export function ComposeForm({
  sendFrom,
  setSendFrom,
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
  setSendFrom: (v: string) => void;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">From</Label>
          <Select
            value={sendFrom || undefined}
            onValueChange={(value) => setSendFrom(value ?? "")}
          >
            <SelectTrigger className="h-10 w-full">
              <SelectValue placeholder="Select sender" />
            </SelectTrigger>
            <SelectContent>
              {addresses.map((a) => (
                <SelectItem key={a.email} value={a.email}>
                  {a.displayName?.trim()
                    ? `${a.displayName.trim()} <${a.email}>`
                    : a.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {displayName ? (
            <p className="text-xs text-muted-foreground">
              Recipients will see: {displayName}
            </p>
          ) : sendFrom ? (
            <p className="text-xs text-muted-foreground">
              No display name set — edit this account under Accounts.
            </p>
          ) : null}
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
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Subject</Label>
        <Input
          value={sendSubject}
          onChange={(e) => setSendSubject(e.target.value)}
          className="h-10"
        />
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-1.5">
        <Label className="text-xs">Message</Label>
        <Textarea
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          rows={16}
          className="min-h-[280px] flex-1 resize-y"
        />
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-4">
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
