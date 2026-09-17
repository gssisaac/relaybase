import { BlockNoteSchema, defaultBlockSpecs } from "@blocknote/core";

import { emailButtonBlockSpec } from "@/lib/markdown-editor/blocks/email-button-block";
import { newsletterImageBlockSpec } from "@/lib/markdown-editor/blocks/newsletter-image-block";
import { newsletterVideoBlockSpec } from "@/lib/markdown-editor/blocks/newsletter-video-block";

export const newsletterEditorSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    image: newsletterImageBlockSpec,
    video: newsletterVideoBlockSpec,
    emailButton: emailButtonBlockSpec,
  },
});

export type NewsletterEditor = import("@blocknote/core").BlockNoteEditor<
  typeof newsletterEditorSchema.blockSchema,
  typeof newsletterEditorSchema.inlineContentSchema,
  typeof newsletterEditorSchema.styleSchema
>;
