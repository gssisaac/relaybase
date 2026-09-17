"use client";

import { parseYouTubeUrl } from "@/lib/markdown-editor/utils/youtube";

/** 16:9 iframe embed sized for BlockNote file blocks (avoids fit-content collapse). */
export function YouTubeEmbedFrame({
  url,
  title,
  width = 560,
}: {
  url: string;
  title?: string;
  width?: number;
}) {
  const yt = parseYouTubeUrl(url);
  if (!yt) return null;

  return (
    <div
      className="bn-youtube-embed"
      style={{ width: `${width}px`, maxWidth: "100%" }}
      contentEditable={false}
    >
      <div className="bn-youtube-embed-ratio">
        <iframe
          src={yt.embedUrl}
          title={title || "YouTube video player"}
          className="bn-youtube-embed-iframe"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    </div>
  );
}

export const DEFAULT_EMBEDDED_VIDEO_PROPS = {
  showPreview: true,
  previewWidth: 560,
  textAlignment: "left" as const,
  backgroundColor: "default" as const,
  caption: "" as const,
  name: "" as const,
};
