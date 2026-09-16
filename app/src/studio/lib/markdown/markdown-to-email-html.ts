import { marked } from "marked";

/** Studio send pipeline — markdown body fragment for HTML layouts (matches hq/studio render). */
export function markdownToEmailHtml(markdown: string): string {
  const out = marked.parse(markdown ?? "", { gfm: true, breaks: true });
  return typeof out === "string" ? out : "";
}
