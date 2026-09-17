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
        editor.insertInlineContent(
          [{ type: "text", text: entry.token, styles: {} }],
          { updateSelection: true },
        );
      },
    }),
  );

  const defaultItems = [...getDefaultReactSlashMenuItems(editor)];

  if ("emailButton" in editor.schema.blockSchema) {
    defaultItems.push({
      title: "Button",
      subtext: "Email link button (CTA)",
      onItemClick: () => {
        insertOrUpdateBlockForSlashMenu(editor, defaultEmailButtonBlockProps);
      },
      aliases: ["button", "btn", "cta", "link"],
      group: "Email",
      icon: emailButtonSlashMenuIcon,
    });
  }

  const allItems = [...tagItems, ...defaultItems];

  return Promise.resolve(filterSuggestionItems(allItems, query));
}
