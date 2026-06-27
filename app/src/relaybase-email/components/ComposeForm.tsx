"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Address } from "./types";

export function ComposeForm({
  sendFrom,
  setSendFrom,
  addresses,
  sendTo,
  setSendTo,
  sendSubject,
  setSendSubject,
  sendText,
  setSendText,
  sending,
  onSend,
  emailDomain,
}: {
  sendFrom: string;
  setSendFrom: (v: string) => void;
  addresses: Address[];
  sendTo: string;
  setSendTo: (v: string) => void;
  sendSubject: string;
  setSendSubject: (v: string) => void;
  sendText: string;
  setSendText: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  emailDomain?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">From</Label>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={sendFrom}
            onChange={(e) => setSendFrom(e.target.value)}
          >
            <option value="">Select sender</option>
            {addresses.map((a) => (
              <option key={a.email} value={a.email}>
                {a.email}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5 sm:col-span-1">
          <Label className="text-xs">To</Label>
          <Input
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="recipient@example.com"
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
          disabled={sending || !sendFrom || !sendTo || !sendSubject}
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
