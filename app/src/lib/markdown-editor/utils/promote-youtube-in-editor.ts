import { DEFAULT_EMBEDDED_VIDEO_PROPS } from "@/lib/markdown-editor/blocks/youtube-embed-frame";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";
import { isYouTubeUrl } from "@/lib/markdown-editor/utils/youtube";

/** Convert image / link paragraphs that point at YouTube into video blocks in the live document. */
export function promoteYouTubeBlocksInEditor(editor: NewsletterEditor): boolean {
  let changed = false;

  for (const block of editor.document) {
    if (block.type === "image") {
      const url = block.props.url?.trim();
      if (url && isYouTubeUrl(url)) {
        editor.updateBlock(block, {
          type: "video",
          props: {
            url,
            name: block.props.name ?? "",
            caption: block.props.caption ?? "",
            ...DEFAULT_EMBEDDED_VIDEO_PROPS,
            previewWidth: block.props.previewWidth ?? DEFAULT_EMBEDDED_VIDEO_PROPS.previewWidth,
          },
        });
        changed = true;
        continue;
      }
    }

    if (block.type === "video") {
      const url = block.props.url?.trim();
      if (!url || !isYouTubeUrl(url)) continue;
      const needsPreview =
        block.props.showPreview === false || !block.props.previewWidth;
      if (needsPreview) {
        editor.updateBlock(block, {
          props: {
            showPreview: true,
            previewWidth: block.props.previewWidth ?? DEFAULT_EMBEDDED_VIDEO_PROPS.previewWidth,
          },
        });
        changed = true;
      }
    }
  }

  return changed;
}
