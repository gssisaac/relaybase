import { marked, Renderer, type Tokens } from "marked";

type ResourceArticleProps = {
  markdown: string;
};

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

export function ResourceArticle({ markdown }: ResourceArticleProps) {
  const html = withExternalLinkAttrs(
    marked.parse(markdown, { async: false, renderer }) as string,
  );

  return (
    <div
      className="max-w-none space-y-4 text-base leading-relaxed text-foreground/90 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-brand-hover [&_blockquote]:border-l-2 [&_blockquote]:border-brand/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-well [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-sm [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-10 [&_hr]:border-border/60 [&_img]:my-2 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-border/60 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border/60 [&_th]:bg-well [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
