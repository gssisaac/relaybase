"use client";

import { observer } from "mobx-react-lite";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { MessageSquare, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { ComposeAttachmentChips } from "@/email/components/compose/ComposeAttachmentChips";
import type { DraftAttachment } from "@/email/components/mailbox/types";
import { useOptionalMailAccountsStore } from "@/email/components/accounts/MailAccountsContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collectFeedbackAccountContext } from "@/lib/feedback/collect-feedback-account";
import { getFeedbackDraftStore } from "@/lib/feedback/feedback-draft-store";
import { useAppSession } from "@/lib/desktop/app-session";
import { useOptionalMailRuntime } from "@/mail-platform/runtime/MailRuntimeContext";
import { useHqStudioSignedIn } from "@/lib/hq-auth/use-hq-studio-signed-in";
import { useOptionalProductId } from "@/lib/dashboard/shared/ProductContext";

export const FeedbackDialog = observer(function FeedbackDialog() {
  const store = getFeedbackDraftStore();
  const pathname = usePathname();
  const productId = useProductId();
  const session = useAppSession();
  const mailRuntime = useOptionalMailRuntime();
  const mailSession = mailRuntime?.session;
  const studioSignedIn = useHqStudioSignedIn();
  const mailAccountsStore = useOptionalMailAccountsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const attachmentModels: DraftAttachment[] = store.attachments.map((a) => ({
    id: a.id,
    filename: a.filename,
    contentType: a.contentType,
    size: a.size,
    origin: "local",
  }));

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = e.clipboardData?.files;
    const hasFiles =
      (files?.length ?? 0) > 0 ||
      Array.from(e.clipboardData?.items ?? []).some((i) => i.kind === "file");
    if (!hasFiles) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) e.preventDefault();
    void store.addFromTransfer(e.clipboardData);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    e.stopPropagation();
    void store.addFromTransfer(e.dataTransfer);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
  };

  async function handleSend() {
    const account = collectFeedbackAccountContext({
      productId,
      phase: session.phase,
      workerUrl: mailSession?.workerUrl,
      accountEmail: mailSession?.accountEmail,
      enabledMailAccounts: mailAccountsStore?.enabledAccounts.slice(),
      studioSignedIn,
    });
    const result = await store.submit({ pagePath: pathname, account });
    if (result.ok) {
      toast.success("Thanks — your feedback was sent");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <Dialog open={store.dialogOpen} onOpenChange={store.setDialogOpen}>
      <DialogContent className="flex max-h-[min(90vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="size-4 text-muted-foreground" />
            Send feedback
          </DialogTitle>
          <DialogDescription>
            Share bugs, ideas, or rough edges. Paste screenshots directly into
            the message area.
          </DialogDescription>
        </DialogHeader>

        <div
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4"
          onPaste={handlePaste}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="space-y-1.5">
            <Label htmlFor="feedback-message">Message</Label>
            <Textarea
              id="feedback-message"
              value={store.message}
              onChange={(e) => store.setMessage(e.target.value)}
              placeholder="What happened? What would help?"
              rows={10}
              disabled={store.submitting}
              className="min-h-[220px] resize-y text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Screenshots</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={store.submitting}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="size-3.5" />
                Attach image
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                multiple
                onChange={(e) => {
                  const list = e.target.files;
                  if (list?.length) void store.addFiles(Array.from(list));
                  e.target.value = "";
                }}
              />
            </div>
            {store.attachmentError ? (
              <p className="text-xs text-destructive">{store.attachmentError}</p>
            ) : null}
            <ComposeAttachmentChips
              attachments={attachmentModels}
              previewUrls={store.previewUrls}
              onRemove={(id) => void store.removeAttachment(id)}
              onRename={() => {
                /* feedback images keep auto names */
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-email">Email (optional)</Label>
            <Input
              id="feedback-email"
              type="email"
              autoComplete="email"
              value={store.contactEmail}
              onChange={(e) => store.setContactEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={store.submitting}
            />
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={store.submitting}
            onClick={() => store.setDialogOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={store.submitting}
            onClick={() => void handleSend()}
          >
            {store.submitting ? "Sending…" : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
