"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (!sending && sendFrom && sendTo.trim() && sendSubject) {
        e.preventDefault();
        onSend();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="flex min-h-0 flex-1 flex-col bg-card rounded-xl border border-border/40 shadow-sm overflow-hidden"
    >
      {/* Recipient Fields */}
      <div className="flex flex-col divide-y divide-border/20 px-4">
        {/* From Row */}
        <div className="flex items-center py-2.5 text-xs text-muted-foreground">
          <span className="w-16 shrink-0 font-medium select-none">From:</span>
          <span className="truncate font-mono text-foreground">{fromLabel}</span>
          {displayName && (
            <span className="ml-2 text-[10px] bg-secondary px-1.5 py-0.5 rounded-md text-muted-foreground">
              {displayName}
            </span>
          )}
        </div>

        {/* To Row */}
        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground select-none">To:</span>
          <input
            type="text"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="one@example.com, two@example.com"
            className="flex-1 min-w-0 bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-0 focus:ring-0"
          />
        </div>

        {/* Cc Row */}
        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground select-none">Cc:</span>
          <input
            type="text"
            value={sendCc}
            onChange={(e) => setSendCc(e.target.value)}
            placeholder="cc@example.com, team@example.com"
            className="flex-1 min-w-0 bg-transparent py-1.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none border-0 focus:ring-0"
          />
        </div>

        {/* Subject Row */}
        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground select-none">Subject:</span>
          <input
            type="text"
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
            placeholder="Enter subject..."
            className="flex-1 min-w-0 bg-transparent py-1.5 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 outline-none border-0 focus:ring-0"
          />
        </div>
      </div>

      {/* Message Area */}
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <textarea
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          placeholder="Write your message here..."
          className="min-h-0 flex-1 resize-none overflow-y-auto bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 outline-none border-0 focus:ring-0"
        />
      </div>

      {/* Actions Bar */}
      <div className="flex shrink-0 justify-between items-center gap-2 border-t border-border/20 bg-muted/10 px-4 py-3">
        <span className="text-xs text-muted-foreground/60 select-none">
          ⌘Enter to send
        </span>
        <Button
          size="sm"
          onClick={onSend}
          disabled={sending || !sendFrom || !sendTo.trim() || !sendSubject}
          className="px-4"
        >
          {sending ? "Sending…" : "Send"}
        </Button>
      </div>
    </div>
  );
}
