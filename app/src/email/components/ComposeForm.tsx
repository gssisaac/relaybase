"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  draftStatus,
  onDiscard,
  compact,
  allowFromSelect = false,
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
  draftStatus?: string | null;
  onDiscard?: () => void;
  compact?: boolean;
  /** Dropdown only when From was not pre-specified (account / draft / reply). */
  allowFromSelect?: boolean;
}) {
  const selected = addresses.find((a) => a.email === sendFrom);
  const displayName = selected?.displayName?.trim();
  const fromLabel = displayName
    ? `${displayName} <${sendFrom}>`
    : sendFrom || "Select account";

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
      className={
        compact
          ? "flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm"
          : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/40 bg-card shadow-sm"
      }
    >
      <div className="flex flex-col divide-y divide-border/20 px-4">
        <div className="flex items-center gap-2 py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            From:
          </span>
          {allowFromSelect ? (
            <Select
              value={sendFrom || undefined}
              onValueChange={(next) => {
                if (next) setSendFrom(next);
              }}
              disabled={sending || addresses.length === 0}
            >
              <SelectTrigger
                size="sm"
                className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus:ring-0 data-[size=sm]:h-8"
              >
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {addresses.map((address) => {
                  const name = address.displayName?.trim();
                  return (
                    <SelectItem key={address.email} value={address.email}>
                      {name ? `${name} <${address.email}>` : address.email}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          ) : (
            <>
              <span className="truncate font-mono text-sm text-foreground">
                {fromLabel}
              </span>
              {displayName ? (
                <span className="ml-1 shrink-0 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {displayName}
                </span>
              ) : null}
            </>
          )}
        </div>

        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            To:
          </span>
          <input
            type="text"
            value={sendTo}
            onChange={(e) => setSendTo(e.target.value)}
            placeholder="one@example.com, two@example.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="email"
            data-1p-ignore
            data-lpignore="true"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />
        </div>

        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            Cc:
          </span>
          <input
            type="text"
            value={sendCc}
            onChange={(e) => setSendCc(e.target.value)}
            placeholder="cc@example.com, team@example.com"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            inputMode="email"
            data-1p-ignore
            data-lpignore="true"
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />
        </div>

        <div className="flex items-center py-1">
          <span className="w-16 shrink-0 select-none text-xs font-medium text-muted-foreground">
            Subject:
          </span>
          <input
            type="text"
            value={sendSubject}
            onChange={(e) => setSendSubject(e.target.value)}
            placeholder="Enter subject..."
            autoFocus={!compact}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="min-w-0 flex-1 border-0 bg-transparent py-1.5 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-0"
          />
        </div>
      </div>

      <div
        className={
          compact
            ? "flex min-h-[160px] flex-col p-4"
            : "flex min-h-0 flex-1 flex-col p-4"
        }
      >
        <textarea
          value={sendText}
          onChange={(e) => setSendText(e.target.value)}
          placeholder="Write your message here..."
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className={
            compact
              ? "min-h-[140px] resize-y border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
              : "min-h-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/40 focus:ring-0"
          }
        />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border/20 bg-muted/10 px-4 py-3">
        <span className="select-none text-xs text-muted-foreground/60">
          {draftStatus ? draftStatus : "⌘Enter to send"}
        </span>
        <div className="flex items-center gap-2">
          {onDiscard ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onDiscard}
              disabled={sending}
            >
              Discard
            </Button>
          ) : null}
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
    </div>
  );
}
