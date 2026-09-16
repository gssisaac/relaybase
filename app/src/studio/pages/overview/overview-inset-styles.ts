export function formatOverviewWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Inset rows inside section cards — visible lift above card surface in dark mode. */
export const overviewInsetItemClassName =
  "rounded-xl bg-secondary/70 px-3 py-2.5 transition-colors hover:bg-secondary dark:bg-accent/90 dark:hover:bg-accent";

export const overviewInsetHighlightClassName = "rounded-xl bg-secondary px-3 py-2.5 dark:bg-accent";
