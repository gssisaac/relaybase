import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

import { EmailButtonBlockSpec } from "@/lib/markdown-editor/blocks/email-button-block";

export const newsletterEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    emailButton: EmailButtonBlockSpec(),
  },
});

export type NewsletterEditor = import("@blocknote/core").BlockNoteEditor<
  typeof newsletterEditorSchema.blockSchema,
  typeof newsletterEditorSchema.inlineContentSchema,
  typeof newsletterEditorSchema.styleSchema
>;
