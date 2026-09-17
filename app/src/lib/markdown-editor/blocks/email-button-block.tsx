"use client";

import { createReactBlockSpec } from "@blocknote/react";
import { MousePointerClick } from "lucide-react";
import { useMemo } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  normalizeEmailButtonAlign,
  normalizeEmailButtonVariant,
  type EmailButtonAlign,
  type EmailButtonVariant,
} from "@/lib/markdown-editor/utils/email-button-html";
import { cn } from "@/lib/utils";
import { useSelectedBlocks } from "@blocknote/react";

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

function EmailButtonBlockRender(props: {
  block: {
    id: string;
    props: {
      text: string;
      url: string;
      variant: EmailButtonVariant;
      alignment: EmailButtonAlign;
    };
  };
  editor: {
    isEditable: boolean;
    updateBlock: (
      block: { id: string },
      update: { props: Partial<EmailButtonBlockRender["block"]["props"]> },
    ) => void;
  };
}) {
  const selectedBlocks = useSelectedBlocks(props.editor as never);
  const selected = useMemo(
    () => selectedBlocks.some((b) => b.id === props.block.id),
    [props.block.id, selectedBlocks],
  );

  const { text, url, variant, alignment } = props.block.props;
  const label = text.trim() || "Button";

  const previewAlign =
    alignment === "left" ? "justify-start" : alignment === "full" ? "justify-stretch" : "justify-center";

  const updateProps = (patch: Partial<typeof props.block.props>) => {
    props.editor.updateBlock(props.block, {
      props: { ...props.block.props, ...patch },
    });
  };

  return (
    <div className="my-2 space-y-2" contentEditable={false}>
      <div className={cn("flex", previewAlign)}>
        <span
          className={cn(
            "inline-flex max-w-full items-center justify-center rounded-lg px-7 py-2.5 text-sm font-semibold",
            alignment === "full" && "w-full",
            variant === "outline"
              ? "border border-foreground bg-background text-foreground"
              : "bg-foreground text-background",
          )}
        >
          {label}
        </span>
      </div>
      {selected && props.editor.isEditable ? (
        <div
          className="grid gap-2 rounded-lg border border-border/80 bg-muted/30 p-3"
          onMouseDown={(e) => e.stopPropagation()}
        >
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
    render: (props) => <EmailButtonBlockRender {...props} />,
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
