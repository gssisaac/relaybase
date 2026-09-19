"use client";

import {
  mergeCSSClasses,
  type BlockSchema,
  type InlineContentSchema,
  type StyleSchema,
} from "@blocknote/core";
import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react";
import {
  components as shadcnBlockNoteComponents,
  ShadCNComponentsContext,
  ShadCNDefaultComponents,
  type ShadCNComponents,
} from "@blocknote/shadcn";
import { useMemo } from "react";

import { withNewsletterSuggestionMenu } from "@/lib/markdown-editor/components/newsletter-suggestion-menu";

import "@blocknote/shadcn/style.css";

export function MarkdownBlockNoteView<
  BSchema extends BlockSchema,
  ISchema extends InlineContentSchema,
  SSchema extends StyleSchema,
>({
  className,
  shadCNComponents,
  ...rest
}: React.ComponentProps<typeof BlockNoteViewRaw<BSchema, ISchema, SSchema>> & {
  shadCNComponents?: Partial<ShadCNComponents>;
}) {
  const shadcnValue = useMemo(
    () => ({
      ...ShadCNDefaultComponents,
      ...shadCNComponents,
    }),
    [shadCNComponents],
  );

  const componentsValue = useMemo(
    () => withNewsletterSuggestionMenu(shadcnBlockNoteComponents),
    [],
  );

  return (
    <ShadCNComponentsContext.Provider value={shadcnValue}>
      <ComponentsContext.Provider value={componentsValue}>
        <BlockNoteViewRaw
          className={mergeCSSClasses("bn-shadcn", className || "")}
          {...rest}
        />
      </ComponentsContext.Provider>
    </ShadCNComponentsContext.Provider>
  );
}
