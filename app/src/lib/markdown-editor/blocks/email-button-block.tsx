"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { ExternalLink, MousePointerClick, Settings2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";
import {
  emailButtonEditorRowClassName,
  normalizeEmailButtonAlign,
  normalizeEmailButtonVariant,
  type EmailButtonAlign,
  type EmailButtonVariant,
} from "@/lib/markdown-editor/utils/email-button-html";
import { cn } from "@/lib/utils";

const emailButtonPropSchema = {
  text: { default: "Button" as const },
  url: { default: "https://" as const },
  variant: {
    default: "primary" as const,
    values: ["primary", "outline"] as const,
  },
  alignment: {
    default: "center" as const,
    values: ["left", "center", "right", "full"] as const,
  },
} as const;

function parseEmailButtonElement(element: HTMLElement) {
  if (element.tagName !== "DIV" || !element.hasAttribute("data-rb-email-button")) {
    return undefined;
  }
  return {
    text: element.getAttribute("data-text") ?? "Button",
    url: element.getAttribute("data-href") ?? "https://",
    variant: normalizeEmailButtonVariant(element.getAttribute("data-variant")),
    alignment: normalizeEmailButtonAlign(element.getAttribute("data-align")),
  };
}

export type EmailButtonBlockProps = {
  text: string;
  url: string;
  variant: EmailButtonVariant;
  alignment: EmailButtonAlign;
};

function previewButtonClassName(
  variant: EmailButtonVariant,
  alignment: EmailButtonAlign,
  extra?: string,
) {
  return cn(
    "inline-flex min-h-10 items-center justify-center rounded-lg px-7 py-2.5 text-sm font-semibold shadow-sm transition-all",
    alignment === "full" ? "w-full" : "max-w-full",
    variant === "outline"
      ? "border border-zinc-800 bg-white text-zinc-900 dark:border-zinc-200 dark:bg-zinc-950 dark:text-zinc-50"
      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
    extra,
  );
}

function EmailButtonSettingsPanel(props: {
  blockId: string;
  text: string;
  url: string;
  variant: EmailButtonVariant;
  alignment: EmailButtonAlign;
  hasValidUrl: boolean;
  textInputRef: RefObject<HTMLInputElement | null>;
  onClose: () => void;
  onChange: (patch: Partial<EmailButtonBlockProps>) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold tracking-tight text-foreground">
          <MousePointerClick className="size-3.5 text-muted-foreground" />
          Button settings
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {props.hasValidUrl ? (
            <a
              href={props.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              title="Test link in new tab"
            >
              <ExternalLink className="size-3" />
              Test link
            </a>
          ) : null}
          <Button
            type="button"
            size="xs"
            variant="secondary"
            className="h-6 px-2 text-[11px]"
            onClick={props.onClose}
          >
            Done
          </Button>
        </div>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="space-y-1">
          <Label htmlFor={`email-btn-text-${props.blockId}`} className="text-xs font-medium">
            Button text
          </Label>
          <Input
            ref={props.textInputRef}
            id={`email-btn-text-${props.blockId}`}
            value={props.text}
            onChange={(e) => props.onChange({ text: e.target.value })}
            placeholder="Read more"
            className="h-8 text-xs"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor={`email-btn-url-${props.blockId}`} className="text-xs font-medium">
            Link URL
          </Label>
          <Input
            id={`email-btn-url-${props.blockId}`}
            value={props.url}
            onChange={(e) => props.onChange({ url: e.target.value })}
            placeholder="https://example.com"
            className="h-8 font-mono text-xs"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Style</Label>
            <Select
              value={props.variant}
              onValueChange={(value) =>
                props.onChange({ variant: normalizeEmailButtonVariant(value) })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                <SelectItem value="primary" className="text-xs">
                  Solid
                </SelectItem>
                <SelectItem value="outline" className="text-xs">
                  Outline
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Alignment</Label>
            <Select
              value={props.alignment}
              onValueChange={(value) =>
                props.onChange({ alignment: normalizeEmailButtonAlign(value) })
              }
            >
              <SelectTrigger className="h-8 w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                <SelectItem value="left" className="text-xs">
                  Left
                </SelectItem>
                <SelectItem value="center" className="text-xs">
                  Center
                </SelectItem>
                <SelectItem value="right" className="text-xs">
                  Right
                </SelectItem>
                <SelectItem value="full" className="text-xs">
                  Full width
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <p className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
        Press Esc or click outside to close
      </p>
    </>
  );
}

function EmailButtonBlockRender(props: {
  block: {
    id: string;
    props: EmailButtonBlockProps;
  };
  editor: NewsletterEditor;
}) {
  const [open, setOpen] = useState(false);
  const textInputRef = useRef<HTMLInputElement>(null);

  const text = props.block.props?.text ?? "Button";
  const url = props.block.props?.url ?? "https://";
  const variant = normalizeEmailButtonVariant(props.block.props?.variant);
  const alignment = normalizeEmailButtonAlign(props.block.props?.alignment);
  const label = (typeof text === "string" ? text.trim() : "") || "Button";
  const editable = props.editor?.isEditable ?? true;
  const blockId = props.block?.id ?? "new";
  const rowClassName = emailButtonEditorRowClassName(alignment);

  const updateProps = (patch: Partial<EmailButtonBlockProps>) => {
    if (!props.editor || !props.block) return;
    props.editor.updateBlock(props.block, {
      props: {
        text,
        url,
        variant,
        alignment,
        ...patch,
      },
    });
  };

  const hasValidUrl =
    typeof url === "string" &&
    (url.startsWith("http://") || url.startsWith("https://")) &&
    url.length > 8;

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => {
      textInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(focusTimer);
  }, [open]);

  if (!editable) {
    return (
      <div className="my-2 w-full max-w-full" contentEditable={false}>
        <div className={rowClassName}>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={previewButtonClassName(variant, alignment)}
          >
            {label}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="my-2 w-full max-w-full select-none" contentEditable={false}>
      <div className={rowClassName}>
        <Popover open={open} onOpenChange={setOpen}>
          <div className={cn("group/btn relative inline-flex", alignment === "full" && "w-full")}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Edit email button"
                  onMouseDown={(e) => e.stopPropagation()}
                  className={cn(
                    previewButtonClassName(
                      variant,
                      alignment,
                      cn(
                        "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                        variant === "outline"
                          ? "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          : "hover:bg-zinc-800 dark:hover:bg-zinc-200",
                        open && "ring-2 ring-primary/40 ring-offset-2",
                      ),
                    ),
                  )}
                />
              }
            >
              {label}
            </PopoverTrigger>

            <button
              type="button"
              aria-label="Button settings"
              title="Button settings"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((prev) => !prev);
              }}
              className={cn(
                "absolute -top-2.5 -right-2.5 flex size-6 cursor-pointer items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-xs transition-opacity hover:text-foreground",
                open ? "opacity-100 text-foreground ring-1 ring-primary/50" : "opacity-0 group-hover/btn:opacity-100",
              )}
            >
              <Settings2 className="size-3.5" />
            </button>
          </div>

          <PopoverContent
            align="center"
            side="bottom"
            sideOffset={8}
            className="z-[80] w-80 max-w-[min(20rem,calc(100vw-2rem))] gap-0 p-3.5"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <EmailButtonSettingsPanel
              blockId={blockId}
              text={text}
              url={url}
              variant={variant}
              alignment={alignment}
              hasValidUrl={hasValidUrl}
              textInputRef={textInputRef}
              onClose={() => setOpen(false)}
              onChange={updateProps}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

export const EmailButtonBlockSpec = createReactBlockSpec(
  {
    type: "emailButton",
    propSchema: emailButtonPropSchema,
    content: "none",
  },
  {
    render: (props) => (
      <EmailButtonBlockRender
        block={
          props.block as {
            id: string;
            props: EmailButtonBlockProps;
          }
        }
        editor={props.editor as unknown as NewsletterEditor}
      />
    ),
    parse: parseEmailButtonElement,
    toExternalHTML: (props) => {
      const text = props.block.props?.text ?? "Button";
      const url = props.block.props?.url ?? "https://";
      const variant = normalizeEmailButtonVariant(props.block.props?.variant);
      const alignment = normalizeEmailButtonAlign(props.block.props?.alignment);
      return (
        <div
          data-rb-email-button=""
          data-text={text}
          data-href={url}
          data-variant={variant}
          data-align={alignment}
        />
      );
    },
  },
);

/** Single schema instance — call the factory once to avoid HMR / duplicate spec issues. */
export const emailButtonBlockSpec = EmailButtonBlockSpec();

export const emailButtonSlashMenuIcon = <MousePointerClick className="size-3.5 text-muted-foreground" />;

export const defaultEmailButtonBlockProps = {
  type: "emailButton" as const,
  props: {
    text: "Button",
    url: "https://",
    variant: "primary" as const,
    alignment: "center" as const,
  },
};
