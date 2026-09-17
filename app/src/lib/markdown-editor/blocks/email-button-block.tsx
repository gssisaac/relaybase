"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { MousePointerClick } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NewsletterEditor } from "@/lib/markdown-editor/schema/newsletter-editor-schema";
import {
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
    values: ["left", "center", "full"] as const,
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

type EmailButtonBlockProps = {
  text: string;
  url: string;
  variant: EmailButtonVariant;
  alignment: EmailButtonAlign;
};

function EmailButtonBlockRender(props: {
  block: {
    id: string;
    props: EmailButtonBlockProps;
  };
  editor: NewsletterEditor;
}) {
  const { text, url, variant, alignment } = props.block.props;
  const label = text.trim() || "Button";
  const editable = props.editor.isEditable;

  const previewAlign =
    alignment === "left" ? "justify-start" : alignment === "full" ? "justify-stretch" : "justify-center";

  const updateProps = (patch: Partial<EmailButtonBlockProps>) => {
    props.editor.updateBlock(props.block, {
      props: { ...props.block.props, ...patch },
    });
  };

  return (
    <div className="my-1 space-y-2" contentEditable={false}>
      <div className={cn("flex", previewAlign)}>
        <span
          className={cn(
            "inline-flex max-w-full min-h-10 items-center justify-center rounded-lg px-7 py-2.5 text-sm font-semibold shadow-sm",
            alignment === "full" && "w-full",
            variant === "outline"
              ? "border border-zinc-800 bg-white text-zinc-900 dark:border-zinc-200 dark:bg-zinc-950 dark:text-zinc-50"
              : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
          )}
        >
          {label}
        </span>
      </div>
      {editable ? (
        <div
          className="grid gap-2 rounded-lg border border-border/80 bg-muted/40 p-3"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="grid gap-1.5 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`email-btn-text-${props.block.id}`}>Button label</Label>
              <Input
                id={`email-btn-text-${props.block.id}`}
                value={text}
                onChange={(e) => updateProps({ text: e.target.value })}
                placeholder="Read more"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`email-btn-url-${props.block.id}`}>Link URL</Label>
              <Input
                id={`email-btn-url-${props.block.id}`}
                value={url}
                onChange={(e) => updateProps({ url: e.target.value })}
                placeholder="https://"
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Style</Label>
              <Select
                value={variant}
                onValueChange={(value) =>
                  updateProps({ variant: normalizeEmailButtonVariant(value) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Solid</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Alignment</Label>
              <Select
                value={alignment}
                onValueChange={(value) =>
                  updateProps({ alignment: normalizeEmailButtonAlign(value) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="center">Center</SelectItem>
                  <SelectItem value="full">Full width</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : null}
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
        editor={props.editor as NewsletterEditor}
      />
    ),
    parse: parseEmailButtonElement,
    toExternalHTML: (props) => (
      <div
        data-rb-email-button=""
        data-text={props.block.props.text}
        data-href={props.block.props.url}
        data-variant={props.block.props.variant}
        data-align={props.block.props.alignment}
      />
    ),
  },
);

export const emailButtonSlashMenuIcon = <MousePointerClick className="size-[18px]" />;

export const defaultEmailButtonBlockProps = {
  type: "emailButton" as const,
  props: {
    text: "Button",
    url: "https://",
    variant: "primary" as const,
    alignment: "center" as const,
  },
};

/** Insert a button block and keep the cursor on it (slash menu). */
export function insertEmailButtonAtCursor(editor: NewsletterEditor) {
  const currentBlock = editor.getTextCursorPosition().block;
  const content = currentBlock.content;
  const isSlashOnly =
    Array.isArray(content) &&
    content.length === 1 &&
    content[0].type === "text" &&
    typeof content[0].text === "string" &&
    content[0].text === "/";
  const isEmptyParagraph =
    currentBlock.type === "paragraph" &&
    Array.isArray(content) &&
    (content.length === 0 ||
      (content.length === 1 &&
        content[0].type === "text" &&
        typeof content[0].text === "string" &&
        content[0].text.trim() === ""));

  let newBlock;
  if (isEmptyParagraph || isSlashOnly) {
    newBlock = editor.updateBlock(currentBlock, defaultEmailButtonBlockProps);
  } else {
    [newBlock] = editor.insertBlocks([defaultEmailButtonBlockProps], currentBlock, "after");
  }
  editor.setTextCursorPosition(newBlock, "end");
}
