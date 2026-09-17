import type { BlockNoteEditor } from "@blocknote/core";
import {
  filterSuggestionItems,
  insertOrUpdateBlockForSlashMenu,
} from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";

import {
  defaultEmailButtonBlockProps,
  emailButtonSlashMenuIcon,
} from "@/lib/markdown-editor/blocks/email-button-block";

export function getNewsletterEditorSlashMenuItems(
  editor: BlockNoteEditor,
  query: string,
) {
  const items = [...getDefaultReactSlashMenuItems(editor)];

  if ("emailButton" in editor.schema.blockSchema) {
    items.push({
      title: "Button",
      subtext: "Email link button (CTA)",
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, defaultEmailButtonBlockProps);
      },
      aliases: ["button", "btn", "cta", "link"],
      group: "Email",
      icon: emailButtonSlashMenuIcon,
      key: "email_button",
    });
  }

  return Promise.resolve(filterSuggestionItems(items, query));
}
