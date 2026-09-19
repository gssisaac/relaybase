"use client";

import { createImageBlockConfig, imageParse } from "@blocknote/core";
import {
  createReactBlockSpec,
  FigureWithCaption,
  LinkWithCaption,
  ResizableFileBlockWrapper,
  useResolveUrl,
  type ReactCustomBlockRenderProps,
} from "@blocknote/react";
import { ImageIcon } from "lucide-react";

import { YouTubeEmbedFrame } from "@/lib/markdown-editor/blocks/youtube-embed-frame";
import { isYouTubeUrl } from "@/lib/markdown-editor/utils/youtube";

const NewsletterImagePreview = (
  props: Omit<
    ReactCustomBlockRenderProps<typeof createImageBlockConfig>,
    "contentRef"
  >,
) => {
  const url = props.block.props.url || "";
  if (url && isYouTubeUrl(url)) {
    return (
      <YouTubeEmbedFrame
        url={url}
        title={props.block.props.name || undefined}
        width={props.block.props.previewWidth ?? 560}
      />
    );
  }

  const resolved = useResolveUrl(url);
  const alt = props.block.props.name || "";

  return (
    <img
      className="bn-visual-media"
      src={
        resolved.loadingState === "loading"
          ? url
          : resolved.downloadUrl
      }
      alt={alt}
      width={props.block.props.previewWidth}
      contentEditable={false}
      draggable={false}
    />
  );
};

const NewsletterImageToExternalHTML = (
  props: Omit<
    ReactCustomBlockRenderProps<typeof createImageBlockConfig>,
    "contentRef"
  >,
) => {
  if (!props.block.props.url) {
    return <p>Add image</p>;
  }

  const alt = props.block.props.name || "";
  const image = props.block.props.showPreview ? (
    <img
      src={props.block.props.url}
      alt={alt}
      width={props.block.props.previewWidth}
    />
  ) : (
    <a href={props.block.props.url}>
      {props.block.props.name || props.block.props.url}
    </a>
  );

  if (props.block.props.caption) {
    return props.block.props.showPreview ? (
      <FigureWithCaption caption={props.block.props.caption}>
        {image}
      </FigureWithCaption>
    ) : (
      <LinkWithCaption caption={props.block.props.caption}>
        {image}
      </LinkWithCaption>
    );
  }

  return image;
};

const NewsletterImageBlock = (
  props: ReactCustomBlockRenderProps<typeof createImageBlockConfig>,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonIcon={<ImageIcon className="size-6 text-muted-foreground" />}
    >
      <NewsletterImagePreview {...(props as any)} />
    </ResizableFileBlockWrapper>
  );
};

export const newsletterImageBlockSpec = createReactBlockSpec(
  createImageBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ["image/*"],
    },
    render: NewsletterImageBlock,
    parse: imageParse(config),
    toExternalHTML: NewsletterImageToExternalHTML,
    runsBefore: ["file"],
  }),
)();
