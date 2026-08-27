import { desktopAwareFetch } from "@/lib/desktop/api";
import {
  desktopSaveDownloadFile,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

export type DownloadResult = {
  filename: string;
  /** Absolute path when saved via the desktop shell. */
  filePath?: string;
  /** Blob URL for opening in the browser after a web download. */
  blobUrl?: string;
};

/** Trigger a browser / webview download for a blob. Returns the blob URL for later open. */
export function downloadBlob(blob: Blob, filename: string): string {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return url;
}

/** Fetch attachment bytes from an authenticated inbox attachment path. */
export async function fetchAttachmentBlob(path: string): Promise<Blob> {
  const res = await desktopAwareFetch(path);
  if (!res.ok) {
    throw new Error("Failed to load attachment");
  }
  return res.blob();
}

/** Download a single attachment to the user's default download location. */
export async function downloadAttachment(
  path: string,
  filename: string,
): Promise<DownloadResult> {
  const blob = await fetchAttachmentBlob(path);
  if (isDesktopRuntime()) {
    const buffer = await blob.arrayBuffer();
    const filePath = await desktopSaveDownloadFile(
      filename,
      new Uint8Array(buffer),
    );
    return { filename, filePath };
  }
  const blobUrl = downloadBlob(blob, filename);
  return { filename, blobUrl };
}

export type AttachmentDownloadItem = {
  path: string;
  filename: string;
};

/** Download multiple attachments sequentially (avoids popup blockers). */
export async function downloadAllAttachments(
  items: AttachmentDownloadItem[],
): Promise<DownloadResult[]> {
  const results: DownloadResult[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    results.push(await downloadAttachment(item.path, item.filename));
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  return results;
}
