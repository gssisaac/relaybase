"use client";

import { useEffect, useRef } from "react";
import { useCreateBlockNote, BlockNoteViewRaw as BlockNoteView } from "@blocknote/react";
import "@blocknote/core/style.css";
import "@blocknote/react/style.css";

/**
 * P0-6 content editor. Ports the *capability* Railmark already proved out
 * (BlockNote WYSIWYG, markdown round-trip) rather than its exact files —
 * Railmark's CSS polish (table grippers, list marker sizing, etc.) and its
 * vault/hash-router integration are intentionally left out; see
 * docs/features/crm-mode-v0.2.md P0-6 "what to port" table.
 */
export default function MarkdownEditor({
  value,
  onChange,
  editable = true,
}: {
  value: string;
  onChange: (content: { markdown: string; html: string }) => void;
  editable?: boolean;
}) {
  const editor = useCreateBlockNote();
  const hydrated = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Hydrate once on mount only — re-running on every `value` change would
  // fight the user's own typing, since onChange below feeds edits back into
  // that same prop (the echo loop Railmark's docs call out). A campaign
  // switch remounts this component (see CampaignContentView's `key`), which
  // is the only time content should reload from outside.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    if (value) {
      const blocks = editor.tryParseMarkdownToBlocks(value);
      editor.replaceBlocks(editor.document, blocks);
    }
    onChangeRef.current({
      markdown: editor.blocksToMarkdownLossy(),
      html: editor.blocksToHTMLLossy(),
    });
  }, [editor, value]);

  return (
    <BlockNoteView
      editor={editor}
      editable={editable}
      onChange={() =>
        onChange({
          markdown: editor.blocksToMarkdownLossy(),
          html: editor.blocksToHTMLLossy(),
        })
      }
      className="min-h-0 flex-1 [&_.bn-container]:h-full [&_.bn-container]:border-0 [&_.bn-container]:bg-transparent [&_.bn-editor]:px-1"
    />
  );
}
