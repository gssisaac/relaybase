/** Folder stem for page-relative asset paths (matches app markdown-editor assets.ts). */
export function scaleAssetFolderStem(ownerId: string): string {
  return (
    ownerId
      .replace(/^newsletter_/, "")
      .replace(/^broadcast_/, "")
      .replace(/^automation_/, "")
      .replace(/^msgtpl_/, "")
      .slice(0, 32) || "asset"
  );
}

/** Resolve `./.{stem}/filename` (or already-absolute Scale asset URLs) for send-time HTML. */
export function resolveScaleAssetUrl(
  ownerId: string,
  scaleBaseUrl: string,
  href: string,
): string | null {
  const trimmed = href.trim();
  if (!trimmed || /^(https?:|data:|blob:)/i.test(trimmed)) return null;

  const templateAssetMatch = trimmed.match(/^\/scale\/assets\/template\/([^/]+)\/(.+)$/);
  if (templateAssetMatch) {
    const templateId = decodeURIComponent(templateAssetMatch[1] ?? "");
    const filename = templateAssetMatch[2] ?? "";
    if (templateId && filename && !filename.includes("..")) {
      return `${scaleBaseUrl}/scale/assets/template/${encodeURIComponent(templateId)}/${encodeURIComponent(filename)}`;
    }
  }

  const newsletterAssetMatch = trimmed.match(/^\/scale\/assets\/([^/]+)\/(.+)$/);
  if (newsletterAssetMatch) {
    const refId = decodeURIComponent(newsletterAssetMatch[1] ?? "");
    const filename = newsletterAssetMatch[2] ?? "";
    if (refId && filename && !filename.includes("..")) {
      return `${scaleBaseUrl}/scale/assets/${encodeURIComponent(refId)}/${encodeURIComponent(filename)}`;
    }
  }

  const relative = trimmed.replace(/^\.\//, "");
  const folder = `.${scaleAssetFolderStem(ownerId)}`;
  if (!relative.startsWith(`${folder}/`)) return null;
  const filename = relative.slice(folder.length + 1);
  if (!filename || filename.includes("..")) return null;

  if (ownerId.startsWith("msgtpl_")) {
    return `${scaleBaseUrl}/scale/assets/template/${encodeURIComponent(ownerId)}/${encodeURIComponent(filename)}`;
  }

  return `${scaleBaseUrl}/scale/assets/${encodeURIComponent(ownerId)}/${encodeURIComponent(filename)}`;
}
