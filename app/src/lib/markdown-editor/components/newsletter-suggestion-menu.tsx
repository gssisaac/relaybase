import { assertEmpty } from "@blocknote/core";
import {
  ComponentProps,
  elementOverflow,
  mergeRefs,
  type Components,
} from "@blocknote/react";
import { forwardRef, useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

const slashMenuIconClass =
  "flex size-7 shrink-0 items-center justify-center text-xs font-medium text-muted-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground";

export const NewsletterSuggestionMenuRoot = forwardRef<
  HTMLDivElement,
  ComponentProps["SuggestionMenu"]["Root"]
>((props, ref) => {
  const { className, children, id, ...rest } = props;
  assertEmpty(rest);

  return (
    <div
      id={id}
      role="listbox"
      className={cn(
        "bn-suggestion-menu z-50 max-h-(--radix-dropdown-menu-content-available-height) min-w-56 max-w-sm overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10",
        className,
      )}
      ref={ref}
    >
      {children}
    </div>
  );
});
NewsletterSuggestionMenuRoot.displayName = "NewsletterSuggestionMenuRoot";

export const NewsletterSuggestionMenuLabel = forwardRef<
  HTMLDivElement,
  ComponentProps["SuggestionMenu"]["Label"]
>((props, ref) => {
  const { className, children, ...rest } = props;
  assertEmpty(rest);

  return (
    <div
      className={cn(
        "px-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80",
        className,
      )}
      ref={ref}
    >
      {children}
    </div>
  );
});
NewsletterSuggestionMenuLabel.displayName = "NewsletterSuggestionMenuLabel";

export const NewsletterSuggestionMenuItem = forwardRef<
  HTMLDivElement,
  ComponentProps["SuggestionMenu"]["Item"]
>((props, ref) => {
  const { className, item, isSelected, onClick, id, ...rest } = props;
  assertEmpty(rest);

  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!itemRef.current || !isSelected) {
      return;
    }

    const overflow = elementOverflow(
      itemRef.current,
      itemRef.current.closest(".bn-suggestion-menu, #ai-suggestion-menu")!,
    );

    if (overflow !== "none") {
      itemRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [isSelected]);

  const compact = item.size === "small";
  const isTagToken = item.title.startsWith("{{") && item.title.endsWith("}}");

  return (
    <div
      className={cn(
        "relative flex w-full min-w-0 cursor-default select-none items-center rounded-md outline-hidden",
        compact ? "gap-2 py-0.5 pl-1.5 pr-2" : "gap-1.5 py-1 pl-1.5 pr-2",
        "hover:bg-accent hover:text-accent-foreground",
        isSelected && "bg-accent text-accent-foreground",
        className,
      )}
      ref={mergeRefs([ref, itemRef])}
      id={id}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      role="option"
      aria-selected={isSelected || undefined}
    >
      {item.icon ? (
        <div className={slashMenuIconClass} data-position="left">
          {item.icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate leading-snug",
            isTagToken
              ? "font-mono text-xs font-semibold tracking-tight text-foreground"
              : compact
                ? "text-sm font-normal"
                : "text-sm font-medium text-foreground",
            isSelected && "text-accent-foreground",
          )}
        >
          {item.title}
        </div>
        {!compact && item.subtext ? (
          <div className="truncate text-xs font-normal leading-snug text-muted-foreground">
            {item.subtext}
          </div>
        ) : null}
      </div>
      {item.badge ? (
        <span
          data-position="right"
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
        >
          {item.badge}
        </span>
      ) : null}
    </div>
  );
});
NewsletterSuggestionMenuItem.displayName = "NewsletterSuggestionMenuItem";

export function withNewsletterSuggestionMenu(components: Components): Components {
  return {
    ...components,
    SuggestionMenu: {
      ...components.SuggestionMenu,
      Root: NewsletterSuggestionMenuRoot,
      Item: NewsletterSuggestionMenuItem,
      Label: NewsletterSuggestionMenuLabel,
    },
  };
}
