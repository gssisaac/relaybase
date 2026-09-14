import { assetKindFromHref } from "./assets";

const VIDEO_IMAGE_MD_RE =
  /!\[([^\]]*)\]\(([^)\s]+\.(?:mp4|webm|ogv|mov|mkv|m4v|avi|wmv|flv))\)/gi;

type InlineText = { type: "text"; text: string; styles?: Record<string, unknown> };
type InlineLink = { type: "link"; href: string; content: unknown[] };

function isInlineLink(node: unknown): node is InlineLink {
  return !!node && typeof node === "object" && (node as InlineLink).type === "link";
}

function isInlineText(node: unknown): node is InlineText {
  return (
    !!node &&
    typeof node === "object" &&
    (node as InlineText).type === "text" &&
    typeof (node as InlineText).text === "string"
  );
}

function linkLabel(content: unknown[]): string {
  return content
    .map((node) => (isInlineText(node) ? node.text : ""))
    .join("")
    .trim();
}

function isWhitespaceOnly(content: unknown[]): boolean {
  return content.every((node) => {
    if (isInlineText(node)) return node.text.trim() === "";
    return false;
  });
}

/** Persist BlockNote video image-syntax as a `<video>` tag. */
export function serializePageMediaMarkdown(markdown: string): string {
  return markdown.replace(VIDEO_IMAGE_MD_RE, (_match, _alt: string, url: string) => {
    return `<video src="${url}" controls></video>`;
  });
}

/**
 * BlockNote treats `![name](relative.mp4)` as an image (its video detector
 * requires an absolute URL) and document links as paragraphs. Promote those
 * back to video / file blocks so the editor matches the reader.
 */
export function promotePageMediaBlocks<T>(blocks: T[]): T[] {
  return blocks.map((block) => promotePageMediaBlock(block) as T);
}

function promotePageMediaBlock(block: unknown): unknown {
  if (!block || typeof block !== "object") return block;
  const next = { ...(block as Record<string, unknown>) };
  if (Array.isArray(next.children)) {
    next.children = next.children.map(promotePageMediaBlock);
  }

  if (next.type === "image") {
    const props = (next.props ?? {}) as { url?: string; name?: string };
    if (props.url && assetKindFromHref(props.url) === "video") {
      return { ...next, type: "video" };
    }
    return next;
  }

  if (next.type !== "paragraph" || !Array.isArray(next.content)) return next;

  const links = next.content.filter(isInlineLink);
  if (links.length !== 1) return next;
  const leftovers = next.content.filter((node) => !isInlineLink(node));
  if (!isWhitespaceOnly(leftovers)) return next;

  const href = links[0].href;
  const kind = assetKindFromHref(href);
  if (kind !== "document" && kind !== "video" && kind !== "audio") {
    return next;
  }

  const name = linkLabel(links[0].content) || href.split("/").pop() || "file";
  if (kind === "video") {
    return {
      ...next,
      type: "video",
      props: {
        url: href,
        name,
        caption: "",
        showPreview: true,
        backgroundColor: "default",
        textAlignment: "left",
      },
      content: undefined,
      children: next.children ?? [],
    };
  }
  if (kind === "audio") {
    return {
      ...next,
      type: "audio",
      props: {
        url: href,
        name,
        caption: "",
        showPreview: true,
        backgroundColor: "default",
      },
      content: undefined,
      children: next.children ?? [],
    };
  }

  return {
    ...next,
    type: "file",
    props: {
      url: href,
      name,
      caption: "",
      backgroundColor: "default",
    },
    content: undefined,
    children: next.children ?? [],
  };
}
