import { marked } from "marked";

import { transformEmailButtonMarkersToBulletproof } from "@/lib/markdown-editor/utils/email-button-html";
import { transformYouTubeEmbedsToHtml } from "@/lib/markdown-editor/utils/youtube";

/** Studio send pipeline — markdown body fragment for HTML layouts (matches hq/studio render). */
export function markdownToEmailHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  const html = typeof out === "string" ? out : "";
  return transformYouTubeEmbedsToHtml(
    transformEmailButtonMarkersToBulletproof(html),
  );
}
