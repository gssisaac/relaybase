import {
  emailButtonMarkerHtml,
  emailButtonPropsFromMarkerHtml,
  isEmailButtonBlock,
  isEmailButtonMarkerHtml,
  type EmailButtonProps,
} from "./email-button-html";

function inlinePlainText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((node) => {
      if (node && typeof node === "object" && "text" in node) {
        return String((node as { text: string }).text);
      }
      return "";
    })
    .join("");
}

function emailButtonBlockFromProps(props: EmailButtonProps): Record<string, unknown> {
  return {
    type: "emailButton",
    props: {
      text: props.text,
      url: props.url,
      variant: props.variant,
      alignment: props.alignment,
    },
    children: [],
  };
}

function promoteEmailButtonBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const next = { ...(block as Record<string, unknown>) };
  if (Array.isArray(next.children)) {
    next.children = next.children.map(promoteEmailButtonBlock);
  }

  if (isEmailButtonBlock(next)) return next;

  if (next.type === "paragraph" && Array.isArray(next.content)) {
    const text = inlinePlainText(next.content).trim();
    if (isEmailButtonMarkerHtml(text)) {
      const props = emailButtonPropsFromMarkerHtml(text);
      if (props) return emailButtonBlockFromProps(props);
    }
  }

  return next;
}

/** Restore email button blocks after markdown parse (marker div lines). */
export function promoteEmailButtonBlocks<T>(blocks: T[]): T[] {
  return blocks.map((block) => promoteEmailButtonBlock(block) as T);
}

export function serializeEmailButtonBlockMarkdown(block: unknown): string | null {
  if (!isEmailButtonBlock(block)) return null;
  return emailButtonMarkerHtml(block.props);
}
