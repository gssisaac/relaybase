import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

import { emailButtonBlockSpec } from "@/lib/markdown-editor/blocks/email-button-block";

export const newsletterEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    emailButton: emailButtonBlockSpec,
  },
});

export type NewsletterEditor = import("@blocknote/core").BlockNoteEditor<
  typeof newsletterEditorSchema.blockSchema,
  typeof newsletterEditorSchema.inlineContentSchema,
  typeof newsletterEditorSchema.styleSchema
>;
