"use client";

import {
  FormattingToolbar,
  useBlockNoteEditor,
  useComponentsContext,
  useEditorState,
  type FormattingToolbarProps,
} from "@blocknote/react";
import { Settings2, Trash2 } from "lucide-react";
import { useCallback } from "react";

import { useEmailButtonSettings } from "@/lib/markdown-editor/blocks/email-button-settings-context";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";

const toolbarIconClass = "size-4 text-muted-foreground";

function useSelectedEmailButtonBlock() {
  const editor = useBlockNoteEditor() as NewsletterEditor;

  return useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed.isEditable) return undefined;
      const selectedBlocks = ed.getSelection()?.blocks ?? [ed.getTextCursorPosition().block];
      if (selectedBlocks.length !== 1) return undefined;
      const block = selectedBlocks[0];
      if (block.type !== "emailButton") return undefined;
      return block;
    },
  });
}

function EmailButtonSettingsToolbarButton() {
  const Components = useComponentsContext()!;
  const block = useSelectedEmailButtonBlock();
  const { setOpenBlockId } = useEmailButtonSettings();
  const editor = useBlockNoteEditor() as NewsletterEditor;

  const onClick = useCallback(() => {
    if (!block) return;
    editor.focus();
    setOpenBlockId(block.id);
  }, [block, editor, setOpenBlockId]);

  if (!block) return null;

  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="Button settings"
      mainTooltip="Button settings"
      icon={<Settings2 className={toolbarIconClass} />}
      onClick={onClick}
    />
  );
}

function EmailButtonDeleteToolbarButton() {
  const Components = useComponentsContext()!;
  const block = useSelectedEmailButtonBlock();
  const editor = useBlockNoteEditor() as NewsletterEditor;

  const onClick = useCallback(() => {
    if (!block) return;
    editor.focus();
    editor.removeBlocks([block.id]);
  }, [block, editor]);

  if (!block) return null;

  return (
    <Components.FormattingToolbar.Button
      className="bn-button"
      label="Delete button"
      mainTooltip="Delete button"
      icon={<Trash2 className={toolbarIconClass} />}
      onClick={onClick}
    />
  );
}

/** Formatting toolbar when an email CTA block is selected. */
export function EmailButtonFormattingToolbar(props: FormattingToolbarProps) {
  const emailBlock = useSelectedEmailButtonBlock();

  if (!emailBlock) {
    return <FormattingToolbar {...props} />;
  }

  return (
    <FormattingToolbar {...props}>
      <EmailButtonSettingsToolbarButton />
      <EmailButtonDeleteToolbarButton />
    </FormattingToolbar>
  );
}
