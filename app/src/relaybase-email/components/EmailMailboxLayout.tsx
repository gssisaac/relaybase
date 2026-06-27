"use client";

import type { LucideIcon } from "lucide-react";
import { Inbox, Send } from "lucide-react";

import { cn } from "@/lib/utils";

export type EmailFolder = "inbox" | "sent";

const FOLDERS: { id: EmailFolder; label: string; icon: LucideIcon }[] = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
];

type EmailFolderNavProps = {
  folder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  inboxCount?: number;
  sentCount?: number;
  className?: string;
};

export function EmailFolderNav({
  folder,
  onFolderChange,
  inboxCount,
  sentCount,
  className,
}: EmailFolderNavProps) {
  const counts: Record<EmailFolder, number | undefined> = {
    inbox: inboxCount,
    sent: sentCount,
  };

  return (
    <nav
      className={cn(
        "flex w-44 shrink-0 flex-col gap-1 border-r border-border bg-muted/20 p-3",
        className,
      )}
      aria-label="Mail folders"
    >
      {FOLDERS.map((item) => {
        const Icon = item.icon;
        const active = folder === item.id;
        const count = counts[item.id];

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onFolderChange(item.id)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">{item.label}</span>
            {count !== undefined && count > 0 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

type EmailMailboxFrameProps = {
  folder: EmailFolder;
  onFolderChange: (folder: EmailFolder) => void;
  inboxCount?: number;
  sentCount?: number;
  toolbar: React.ReactNode;
  alerts?: React.ReactNode;
  children: React.ReactNode;
};

export function EmailMailboxFrame({
  folder,
  onFolderChange,
  inboxCount,
  sentCount,
  toolbar,
  alerts,
  children,
}: EmailMailboxFrameProps) {
  return (
    <div className="flex min-h-[min(70vh,560px)] flex-col gap-4">
      {toolbar}
      {alerts}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg bg-card ring-1 ring-foreground/10">
        <EmailFolderNav
          folder={folder}
          onFolderChange={onFolderChange}
          inboxCount={inboxCount}
          sentCount={sentCount}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
