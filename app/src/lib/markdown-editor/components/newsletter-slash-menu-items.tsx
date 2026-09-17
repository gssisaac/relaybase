import { filterSuggestionItems } from "@blocknote/core/extensions";
import { getDefaultReactSlashMenuItems } from "@blocknote/react";

import {
  emailButtonSlashMenuIcon,
  insertEmailButtonAtCursor,
} from "@/lib/markdown-editor/blocks/email-button-block";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";

export function getNewsletterEditorSlashMenuItems(
  editor: NewsletterEditor,
  query: string,
) {
  const items = [...getDefaultReactSlashMenuItems(editor)];

  if ("emailButton" in editor.schema.blockSchema) {
    items.push({
      title: "Button",
      subtext: "Email link button (CTA)",
      onItemClick: () => {
        insertEmailButtonAtCursor(editor);
      },
      aliases: ["button", "btn", "cta", "link"],
      group: "Email",
      icon: emailButtonSlashMenuIcon,
    });
  }

  return Promise.resolve(filterSuggestionItems(items, query));
}
