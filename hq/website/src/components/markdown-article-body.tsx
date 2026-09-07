"use client";

import { useEffect, useRef } from "react";

type MarkdownArticleBodyProps = {
  html: string;
  className: string;
};

export function MarkdownArticleBody({
  html,
  className,
}: MarkdownArticleBodyProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const onClick = async (event: MouseEvent) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
        "[data-copy-code]",
      );
      if (!button || !root.contains(button)) return;

      const block = button.closest(".md-code-block");
      const code = block?.querySelector("code");
      if (!code?.textContent) return;

      try {
        await navigator.clipboard.writeText(code.textContent);
        button.dataset.copied = "true";
        window.setTimeout(() => {
          delete button.dataset.copied;
        }, 2000);
      } catch {
        // Clipboard API unavailable — ignore.
      }
    };

    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [html]);

  return (
    <div
      ref={rootRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
