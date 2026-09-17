export type YouTubeVideoDetails = {
  videoId: string;
  listId?: string;
  startTime?: string;
  embedUrl: string;
  watchUrl: string;
  thumbnailUrl: string;
  maxResThumbnailUrl: string;
};

export function parseYouTubeTimeToSeconds(time: string): number {
  if (/^\d+$/.test(time)) return parseInt(time, 10);
  const match = time.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i);
  if (!match) return 0;
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export function parseYouTubeUrl(url: string | null | undefined): YouTubeVideoDetails | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const raw = trimmed.startsWith("http://") || trimmed.startsWith("https://") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

    let videoId: string | null = null;
    const listId = parsed.searchParams.get("list") ?? undefined;
    const startTime = parsed.searchParams.get("t") ?? parsed.searchParams.get("start") ?? undefined;

    if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1).split("/")[0] || null;
    } else if (
      host === "youtube.com" ||
      host === "youtube-nocookie.com" ||
      host === "music.youtube.com"
    ) {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v");
      } else if (
        parsed.pathname.startsWith("/embed/") ||
        parsed.pathname.startsWith("/shorts/") ||
        parsed.pathname.startsWith("/live/") ||
        parsed.pathname.startsWith("/v/")
      ) {
        videoId = parsed.pathname.split("/")[2] || null;
      }
    }

    if (!videoId) return null;

    videoId = videoId.split(/[?#&]/)[0].trim();
    if (!/^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) return null;

    const embedParams = new URLSearchParams();
    if (listId) embedParams.set("list", listId);
    if (startTime) {
      const seconds = parseYouTubeTimeToSeconds(startTime);
      if (seconds > 0) embedParams.set("start", String(seconds));
    }
    const embedParamStr = embedParams.toString();
    const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}${embedParamStr ? `?${embedParamStr}` : ""}`;

    const watchParams = new URLSearchParams();
    watchParams.set("v", videoId);
    if (listId) watchParams.set("list", listId);
    if (startTime) watchParams.set("t", startTime);
    const watchUrl = `https://www.youtube.com/watch?${watchParams.toString()}`;

    return {
      videoId,
      listId,
      startTime,
      embedUrl,
      watchUrl,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      maxResThumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    };
  } catch {
    return null;
  }
}

export function isYouTubeUrl(url: string | null | undefined): boolean {
  return parseYouTubeUrl(url) !== null;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Render a bulletproof email-safe YouTube video preview card. */
export function renderYouTubeEmailCard(url: string, title?: string, caption?: string): string {
  const details = parseYouTubeUrl(url);
  if (!details) return "";

  const escapedTitle = escapeHtmlAttr(title || "Watch on YouTube");
  const escapedCaption = caption ? escapeHtmlText(caption.trim()) : "";

  return `<table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin:20px 0;border-collapse:collapse;">
  <tr>
    <td align="center">
      <div style="max-width:560px;width:100%;margin:0 auto;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.12);background-color:#000000;">
        <a href="${details.watchUrl}" target="_blank" rel="noopener noreferrer" style="display:block;position:relative;text-decoration:none;line-height:0;overflow:hidden;border-radius:12px;">
          <img src="${details.thumbnailUrl}" alt="${escapedTitle}" width="560" style="display:block;width:100%;max-width:560px;height:auto;aspect-ratio:16/9;object-fit:cover;border:0;" />
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:68px;height:48px;background-color:rgba(33,33,33,0.85);border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.5);">
            <svg viewBox="0 0 24 24" width="26" height="26" fill="#ffffff" style="display:block;margin-left:2px;">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </a>
      </div>
      ${escapedCaption ? `<div style="font-size:13px;line-height:1.4;color:#64748b;margin-top:8px;text-align:center;">${escapedCaption}</div>` : ""}
    </td>
  </tr>
</table>`;
}

const FIGURE_VIDEO_RE =
  /<figure\b[^>]*>([\s\S]*?)<video\b([^>]*)>(?:[\s\S]*?<\/video>)?([\s\S]*?)<\/figure>/gi;
const VIDEO_TAG_RE = /<video\b([^>]*)>(?:[\s\S]*?<\/video>)?/gi;
const IMG_TAG_RE = /<img\b([^>]*)>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*"([^"]*)"/i;
const DATA_NAME_ATTR_RE = /\bdata-name\s*=\s*"([^"]*)"/i;
const ALT_ATTR_RE = /\balt\s*=\s*"([^"]*)"/i;
const FIGCAPTION_RE = /<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i;

/** Replace video elements and images pointing to YouTube with responsive email cards. */
export function transformYouTubeEmbedsToHtml(html: string): string {
  if (!html) return "";

  // 1. Check figure with video
  let out = html.replace(FIGURE_VIDEO_RE, (full, before, videoAttrs, after) => {
    const srcMatch = videoAttrs.match(SRC_ATTR_RE);
    const src = srcMatch?.[1];
    if (!src || !isYouTubeUrl(src)) return full;

    const figcaptionMatch = (before + after).match(FIGCAPTION_RE);
    const caption = figcaptionMatch ? figcaptionMatch[1].replace(/<[^>]+>/g, "").trim() : undefined;
    const name = videoAttrs.match(DATA_NAME_ATTR_RE)?.[1] || undefined;

    return renderYouTubeEmailCard(src, name, caption);
  });

  // 2. Check standalone video tags
  out = out.replace(VIDEO_TAG_RE, (full, attrs) => {
    const srcMatch = attrs.match(SRC_ATTR_RE);
    const src = srcMatch?.[1];
    if (!src || !isYouTubeUrl(src)) return full;

    const name = attrs.match(DATA_NAME_ATTR_RE)?.[1] || undefined;
    return renderYouTubeEmailCard(src, name);
  });

  // 3. Check standalone img tags (e.g. from markdown ![alt](youtube_url))
  out = out.replace(IMG_TAG_RE, (full, attrs) => {
    const srcMatch = attrs.match(SRC_ATTR_RE);
    const src = srcMatch?.[1];
    if (!src || !isYouTubeUrl(src)) return full;

    const alt = attrs.match(ALT_ATTR_RE)?.[1] || undefined;
    return renderYouTubeEmailCard(src, alt);
  });

  return out;
}
