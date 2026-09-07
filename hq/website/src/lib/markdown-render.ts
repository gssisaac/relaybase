import { marked, Renderer, type Tokens } from "marked";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COPY_ICON = `<svg class="md-code-block__icon-copy size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;

const CHECK_ICON = `<svg class="md-code-block__icon-check hidden size-3.5" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;

function createMarkdownRenderer(): Renderer {
  const renderer = new Renderer();
  const defaultLink = renderer.link.bind(renderer);

  renderer.link = (token: Tokens.Link) => {
    const html = defaultLink(token);
    if (!token.href || !/^https?:\/\//i.test(token.href)) return html;
    return html.replace(
      "<a ",
      '<a target="_blank" rel="noopener noreferrer" ',
    );
  };

  renderer.code = ({ text, lang, escaped }: Tokens.Code) => {
    const language = lang?.trim() || "text";
    const body = escaped ? text : escapeHtml(text);

    return `<div class="md-code-block not-prose my-5 overflow-hidden rounded-xl border border-border/80 bg-slate-950 shadow-sm">
  <div class="md-code-block__header flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/90 px-3 py-2">
    <span class="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-400">${escapeHtml(language)}</span>
    <button type="button" class="md-code-block__copy inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100" aria-label="Copy code" data-copy-code>
      ${COPY_ICON}
      ${CHECK_ICON}
    </button>
  </div>
  <pre class="overflow-x-auto p-4 m-0"><code class="language-${escapeHtml(language)} block font-mono text-[13px] leading-relaxed text-slate-300">${body}</code></pre>
</div>`;
  };

  return renderer;
}

/** Ensure raw HTML and markdown external links open in a new tab. */
function withExternalLinkAttrs(html: string): string {
  return html.replace(/<a\b([^>]*)>/gi, (full, attrs: string) => {
    const hrefMatch = attrs.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch || !/^https?:\/\//i.test(hrefMatch[1])) return full;
    let next = attrs;
    if (!/\btarget\s*=/i.test(next)) {
      next += ' target="_blank"';
    }
    if (!/\brel\s*=/i.test(next)) {
      next += ' rel="noopener noreferrer"';
    }
    return `<a${next}>`;
  });
}

export function renderMarkdownHtml(markdown: string): string {
  const renderer = createMarkdownRenderer();
  const html = marked.parse(markdown, { async: false, renderer }) as string;
  return withExternalLinkAttrs(html);
}
