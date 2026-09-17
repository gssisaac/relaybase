import { marked } from "marked";

import { transformEmailButtonMarkersToBulletproof } from "@/lib/markdown-editor/utils/email-button-html";

/** Studio send pipeline — markdown body fragment for HTML layouts (matches hq/studio render). */
export function markdownToEmailHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  const html = typeof out === "string" ? out : "";
  return transformEmailButtonMarkersToBulletproof(html);
}
