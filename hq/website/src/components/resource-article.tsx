import { MarkdownArticleBody } from "@/components/markdown-article-body";
import { renderMarkdownHtml } from "@/lib/markdown-render";

type ResourceArticleProps = {
  markdown: string;
};

const articleClassName =
  "max-w-none space-y-4 text-base leading-relaxed text-foreground/90 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-brand-hover [&_blockquote]:border-l-2 [&_blockquote]:border-brand/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground [&_figcaption]:mt-2 [&_figcaption]:text-center [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_hr]:my-10 [&_hr]:border-border/60 [&_img]:my-2 [&_img]:h-auto [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-border/60 [&_li]:leading-relaxed [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-6 [&_p]:leading-relaxed [&_strong]:font-semibold [&_strong]:text-foreground [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border/60 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-border/60 [&_th]:bg-well [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-well [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-sm [&_[data-copy-code][data-copied=true]_.md-code-block__icon-check]:inline-block [&_[data-copy-code][data-copied=true]_.md-code-block__icon-copy]:hidden";

export function ResourceArticle({ markdown }: ResourceArticleProps) {
  const html = renderMarkdownHtml(markdown);

  return <MarkdownArticleBody html={html} className={articleClassName} />;
}
