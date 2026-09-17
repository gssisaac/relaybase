import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

import { EmailButtonBlockSpec } from "@/lib/markdown-editor/blocks/email-button-block";

export const newsletterEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    emailButton: EmailButtonBlockSpec(),
  },
});

export type NewsletterEditorSchema = typeof newsletterEditorSchema;
