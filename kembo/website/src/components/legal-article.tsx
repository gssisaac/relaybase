import { marked, Renderer, type Tokens } from "marked";

type LegalArticleProps = {
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

export function LegalArticle({ markdown }: LegalArticleProps) {
  const html = marked.parse(markdown, { async: false, renderer }) as string;

  return (
    <div
      className="max-w-none space-y-4 text-sm leading-relaxed text-foreground/90 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-brand-hover [&_code]:rounded [&_code]:bg-well [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs [&_h2]:mt-9 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-8 [&_hr]:border-border/60 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top [&_th]:border [&_th]:border-border/60 [&_th]:bg-well [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
