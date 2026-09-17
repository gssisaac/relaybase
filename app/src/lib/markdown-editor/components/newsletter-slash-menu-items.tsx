import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import {
  getDefaultReactSlashMenuItems,
  type DefaultReactSuggestionItem,
} from "@blocknote/react";
import { Braces } from "lucide-react";

import {
  defaultEmailButtonBlockProps,
  emailButtonSlashMenuIcon,
} from "@/lib/markdown-editor/blocks/email-button-block";
import { mergeTagSlashMenuEntries } from "@/lib/markdown-editor/components/newsletter-slash-menu-merge-tags";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";
import type { ComposeMergeTagSection } from "@/studio/lib/triggers/trigger-merge-tags";

export { buildMergeTagAliases } from "@/lib/markdown-editor/components/newsletter-slash-menu-merge-tags";

export const mergeTagSlashMenuIcon = (
  <Braces className="size-3.5 text-muted-foreground" />
);

/**
 * Remove the leading `/` and any trailing query text before the cursor
 * so the selected item replaces the slash command cleanly without leaving
 * dangling slash characters or pushing the caret to unexpected positions.
 */
export function cleanSlashQuery(editor: NewsletterEditor): boolean {
  try {
    const tiptap = (
      editor as unknown as { _tiptapEditor?: { state?: { selection: { $from: { parent: { isTextblock: boolean; textBetween: (from: number, to: number, block?: string, leaf?: string) => string }; parentOffset: number; start: () => number; pos: number } }; tr: { delete: (from: number, to: number) => unknown } }; view?: { dispatch: (tr: unknown) => void } } }
    )._tiptapEditor;
    if (tiptap?.state && tiptap?.view) {
      const { state, view } = tiptap;
      const { selection } = state;
      const { $from } = selection;
      const parent = $from.parent;
      if (parent && parent.isTextblock) {
        const textBefore = parent.textBetween(0, $from.parentOffset, undefined, "\ufffc");
        const match = textBefore.match(/\/([^\s/]*)$/);
        if (match && typeof match.index === "number") {
          const fromPos = $from.start() + match.index;
          const toPos = $from.pos;
          if (fromPos < toPos) {
            const tr = state.tr.delete(fromPos, toPos);
            view.dispatch(tr);
            return true;
          }
        }
      }
    }
  } catch (err) {
    console.error("Failed to clean slash query", err);
  }
  return false;
}

export function insertMergeTagAtSlash(editor: NewsletterEditor, token: string): void {
  cleanSlashQuery(editor);
  editor.insertInlineContent(
    [{ type: "text", text: token, styles: {} }],
    { updateSelection: true },
  );
}

export function insertEmailButtonAtSlash(editor: NewsletterEditor): void {
  let isOnlySlash = false;
  try {
    const currentBlock = editor.getTextCursorPosition().block;
    if (currentBlock && Array.isArray(currentBlock.content)) {
      if (currentBlock.content.length === 0) {
        isOnlySlash = true;
      } else if (
        currentBlock.content.length === 1 &&
        currentBlock.content[0].type === "text" &&
        /^(\/[^\s/]*)$/.test(String((currentBlock.content[0] as { text?: string }).text ?? ""))
      ) {
        isOnlySlash = true;
      }
    }
  } catch {
    // ignore
  }

  cleanSlashQuery(editor);

  const currentBlock = editor.getTextCursorPosition().block;
  if (isOnlySlash) {
    editor.updateBlock(currentBlock, defaultEmailButtonBlockProps);
  } else {
    editor.insertBlocks([defaultEmailButtonBlockProps], currentBlock, "after");
  }
}

export function getNewsletterEditorSlashMenuItems(
  editor: NewsletterEditor,
  query: string,
  sections?: ComposeMergeTagSection[],
): Promise<DefaultReactSuggestionItem[]> {
  const tagItems: DefaultReactSuggestionItem[] = mergeTagSlashMenuEntries(sections).map(
    (entry) => ({
      title: entry.title,
      subtext: entry.subtext,
      group: entry.group,
      icon: mergeTagSlashMenuIcon,
      aliases: entry.aliases,
      onItemClick: () => {
        insertMergeTagAtSlash(editor, entry.token);
      },
    }),
  );

  const defaultItems = getDefaultReactSlashMenuItems(editor).map((item) => ({
    ...item,
    onItemClick: () => {
      cleanSlashQuery(editor);
      item.onItemClick();
    },
  }));

  if ("emailButton" in editor.schema.blockSchema) {
    defaultItems.push({
      title: "Button",
      subtext: "Email link button (CTA)",
      onItemClick: () => {
        insertEmailButtonAtSlash(editor);
      },
      aliases: ["button", "btn", "cta", "link"],
      group: "Email",
      icon: emailButtonSlashMenuIcon,
    });
  }

  const allItems = [...tagItems, ...defaultItems];

  return Promise.resolve(filterSuggestionItems(allItems, query));
}
