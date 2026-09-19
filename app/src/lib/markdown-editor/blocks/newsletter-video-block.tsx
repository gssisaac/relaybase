"use client";

import { createVideoBlockConfig, videoParse } from "@blocknote/core";
import {
  createReactBlockSpec,
  FigureWithCaption,
  LinkWithCaption,
  ResizableFileBlockWrapper,
  useResolveUrl,
  type ReactCustomBlockRenderProps,
} from "@blocknote/react";
import { Video } from "lucide-react";

import {
  DEFAULT_EMBEDDED_VIDEO_PROPS,
  YouTubeEmbedFrame,
} from "@/lib/markdown-editor/blocks/youtube-embed-frame";
import { isYouTubeUrl } from "@/lib/markdown-editor/utils/youtube";

export { DEFAULT_EMBEDDED_VIDEO_PROPS };

export const NewsletterVideoPreview = (
  props: Omit<
    ReactCustomBlockRenderProps<typeof createVideoBlockConfig>,
    "contentRef"
  >,
) => {
  const url = props.block.props.url || "";
  const previewWidth = props.block.props.previewWidth ?? 560;

  if (url && isYouTubeUrl(url)) {
    return (
      <YouTubeEmbedFrame
        url={url}
        title={props.block.props.name || undefined}
        width={previewWidth}
      />
    );
  }

  const resolved = useResolveUrl(url);

  return (
    <video
      className="bn-visual-media"
      src={
        resolved.loadingState === "loading"
          ? url
          : resolved.downloadUrl
      }
      controls={true}
      style={{
        width: `${previewWidth}px`,
        maxWidth: "100%",
      }}
      contentEditable={false}
      draggable={false}
    />
  );
};

export const NewsletterVideoToExternalHTML = (
  props: Omit<
    ReactCustomBlockRenderProps<typeof createVideoBlockConfig>,
    "contentRef"
  >,
) => {
  if (!props.block.props.url) {
    return <p>Add video</p>;
  }

  const video = props.block.props.showPreview ? (
    <video
      src={props.block.props.url}
      data-name={props.block.props.name || undefined}
      width={props.block.props.previewWidth || undefined}
      controls
    />
  ) : (
    <a href={props.block.props.url}>
      {props.block.props.name || props.block.props.url}
    </a>
  );

  if (props.block.props.caption) {
    return props.block.props.showPreview ? (
      <FigureWithCaption caption={props.block.props.caption}>
        {video}
      </FigureWithCaption>
    ) : (
      <LinkWithCaption caption={props.block.props.caption}>
        {video}
      </LinkWithCaption>
    );
  }

  return video;
};

export const NewsletterVideoBlock = (
  props: ReactCustomBlockRenderProps<typeof createVideoBlockConfig>,
) => {
  return (
    <ResizableFileBlockWrapper
      {...(props as any)}
      buttonIcon={<Video className="size-6 text-muted-foreground" />}
    >
      <NewsletterVideoPreview {...(props as any)} />
    </ResizableFileBlockWrapper>
  );
};

export const newsletterVideoBlockSpec = createReactBlockSpec(
  createVideoBlockConfig,
  (config) => ({
    meta: {
      fileBlockAccept: ["video/*"],
    },
    render: NewsletterVideoBlock,
    parse: videoParse(config),
    toExternalHTML: NewsletterVideoToExternalHTML,
    runsBefore: ["file"],
  }),
)();
