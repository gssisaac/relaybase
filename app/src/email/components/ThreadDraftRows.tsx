"use client";

import { Mail, Trash2 } from "lucide-react";
import { observer } from "mobx-react-lite";

import { Button } from "@/components/ui/button";
import type { DraftEmail } from "@/email/components/types";
import { draftThreadRowSubtitle } from "@/email/draft-thread-rows";

export const ThreadDraftRows = observer(function ThreadDraftRows({
  drafts,
  parentForDraft,
  onOpen,
  onDelete,
}: {
  drafts: DraftEmail[];
  parentForDraft: (draft: DraftEmail) => { at: string; email: string } | null;
  onOpen: (draft: DraftEmail) => void;
  onDelete: (draft: DraftEmail) => void;
}) {
  if (drafts.length === 0) return null;

  return (
    <div className="divide-y divide-border/30 border-t border-border/30">
      {drafts.map((draft) => {
        const subtitle = draftThreadRowSubtitle(
          draft.body,
          parentForDraft(draft),
        );
        return (
          <div
            key={draft.id}
            className="flex w-full shrink-0 items-center gap-3 px-1 py-3"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left transition-colors hover:opacity-90"
              onClick={() => onOpen(draft)}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-hidden
              >
                <Mail className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#e57373]">
                  Draft
                </p>
                {subtitle ? (
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Delete draft"
              className="shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete(draft);
              }}
            >
              <Trash2 />
            </Button>
          </div>
        );
      })}
    </div>
  );
});
