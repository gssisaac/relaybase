import { assetKindFromHref } from "./assets";
import { isYouTubeUrl } from "./youtube";
import { DEFAULT_EMBEDDED_VIDEO_PROPS } from "@/lib/markdown-editor/utils/default-video-props";

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

function escapeMarkdownLabel(label: string): string {
  return label.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

function isVideoBlock(block: unknown): block is {
  type: "video";
  props: { url?: string; name?: string; caption?: string };
} {
  return !!block && typeof block === "object" && (block as { type?: string }).type === "video";
}

/**
 * BlockNote's markdown exporter omits YouTube (and other non-file) video blocks.
 * Persist them as `![label](url)` so raw ↔ rich toggles keep the embed.
 */
export function serializeVideoBlockMarkdown(block: unknown): string | null {
  if (!isVideoBlock(block)) return null;
  const url = block.props.url?.trim();
  if (!url) return null;

  if (isYouTubeUrl(url) || assetKindFromHref(url) === "video") {
    const label =
      block.props.name?.trim() ||
      block.props.caption?.trim() ||
      (isYouTubeUrl(url) ? "YouTube video" : url.split("/").pop() || "video");
    return `![${escapeMarkdownLabel(label)}](${url})`;
  }

  return null;
}

const YOUTUBE_VIDEO_TAG_RE = /<video\b([^>]*)>\s*<\/video>/gi;

/** Rewrite persisted `<video src="…youtube…">` markers into markdown image syntax before parse. */
export function normalizeYoutubeEmbedsInMarkdown(markdown: string): string {
  return markdown.replace(YOUTUBE_VIDEO_TAG_RE, (full, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc="([^"]*)"/i);
    const src = srcMatch?.[1]?.replace(/&amp;/g, "&") ?? "";
    if (!src || !/(?:youtube\.com|youtu\.be)/i.test(src)) return full;
    const nameMatch = attrs.match(/\bdata-name="([^"]*)"/i);
    const label = nameMatch?.[1]?.replace(/&quot;/g, '"') || "YouTube video";
    return `![${escapeMarkdownLabel(label)}](${src})`;
  });
}

/** Persist BlockNote video image-syntax as a `<video>` tag. */
export function serializePageMediaMarkdown(markdown: string): string {
  return markdown.replace(VIDEO_IMAGE_MD_RE, (_match, _alt: string, url: string) => {
    return `<video src="${url}" controls></video>`;
  });
}

/**
 * BlockNote treats `![name](relative.mp4)` or `![name](youtube_url)` as an image
 * and document / video links as paragraphs. Promote those back to video / file blocks
 * so the editor displays rich interactive media.
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
    const props = (next.props ?? {}) as { url?: string; name?: string; caption?: string };
    if (props.url && (assetKindFromHref(props.url) === "video" || isYouTubeUrl(props.url))) {
      return {
        ...next,
        type: "video",
        props: {
          url: props.url,
          name: props.name || "",
          caption: props.caption || "",
          showPreview: true,
          previewWidth: DEFAULT_EMBEDDED_VIDEO_PROPS.previewWidth,
          backgroundColor: "default",
          textAlignment: "left",
        },
      };
    }
    return next;
  }

  if (next.type !== "paragraph" || !Array.isArray(next.content)) return next;

  const links = next.content.filter(isInlineLink);
  if (links.length !== 1) return next;
  const leftovers = next.content.filter((node) => !isInlineLink(node));
  if (!isWhitespaceOnly(leftovers)) return next;

  const href = links[0].href;
  const isYt = isYouTubeUrl(href);
  const kind = assetKindFromHref(href);
  if (kind !== "document" && kind !== "video" && kind !== "audio" && !isYt) {
    return next;
  }

  const name = linkLabel(links[0].content) || href.split("/").pop() || (isYt ? "YouTube Video" : "file");
  if (kind === "video" || isYt) {
    return {
      ...next,
      type: "video",
      props: {
        url: href,
        name,
        caption: "",
        showPreview: true,
        previewWidth: DEFAULT_EMBEDDED_VIDEO_PROPS.previewWidth,
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
