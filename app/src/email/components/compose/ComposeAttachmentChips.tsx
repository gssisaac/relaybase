"use client";

import * as React from "react";
import { FileIcon, ImageIcon, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { DraftAttachment } from "@/email/components/mailbox/types";
import { formatBytes } from "@/email/lib/attachments/limits";
import { isImageContentType } from "@/email/lib/attachments/image-optimize";

function AttachmentChip({
  attachment,
  previewUrl,
  onRemove,
  onRename,
}: {
  attachment: DraftAttachment;
  previewUrl?: string | null;
  onRemove: () => void;
  onRename: (filename: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(attachment.filename);
  const showImage = isImageContentType(attachment.contentType) && previewUrl;

  React.useEffect(() => {
    setName(attachment.filename);
  }, [attachment.filename]);

  function commitRename() {
    setEditing(false);
    onRename(name);
  }

  return (
    <div className="group flex min-w-0 items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-2 py-1.5">
      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/40">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : isImageContentType(attachment.contentType) ? (
          <ImageIcon className="size-4 text-muted-foreground" aria-hidden />
        ) : (
          <FileIcon className="size-4 text-muted-foreground" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              }
              if (e.key === "Escape") {
                setEditing(false);
                setName(attachment.filename);
              }
            }}
            className="h-7 text-xs"
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="block max-w-full truncate text-left text-xs font-medium text-foreground hover:underline"
            title={attachment.filename}
            onClick={() => setEditing(true)}
          >
            {attachment.filename}
          </button>
        )}
        <p className="text-[10px] text-muted-foreground">
          {formatBytes(attachment.size)}
          {attachment.origin === "source" ? " · from message" : null}
        </p>
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-muted-foreground opacity-70 hover:bg-muted hover:text-foreground group-hover:opacity-100"
        aria-label={`Remove ${attachment.filename}`}
        onClick={onRemove}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function ComposeAttachmentChips({
  attachments,
  previewUrls,
  onRemove,
  onRename,
}: {
  attachments: DraftAttachment[];
  previewUrls: Record<string, string | null>;
  onRemove: (id: string) => void;
  onRename: (id: string, filename: string) => void;
}) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 space-y-2 border-t border-border/20 pt-3">
      <p className="text-xs font-medium text-muted-foreground">
        Attachments ({attachments.length})
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <AttachmentChip
            key={attachment.id}
            attachment={attachment}
            previewUrl={previewUrls[attachment.id]}
            onRemove={() => onRemove(attachment.id)}
            onRename={(filename) => onRename(attachment.id, filename)}
          />
        ))}
      </div>
    </div>
  );
}
