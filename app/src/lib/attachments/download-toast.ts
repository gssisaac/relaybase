import { toast } from "sonner";

import {
  desktopOpenFilePath,
  desktopRevealFileInFolder,
} from "@/lib/desktop/bridge";

import type { DownloadResult } from "@/lib/attachments/download";

/** Keep download toasts visible long enough to use follow-up actions. */
export const DOWNLOAD_TOAST_DURATION_MS = 15_000;

function scheduleBlobRevoke(blobUrl: string): void {
  window.setTimeout(
    () => URL.revokeObjectURL(blobUrl),
    DOWNLOAD_TOAST_DURATION_MS + 1_000,
  );
}

async function openDownloadedFile(result: DownloadResult): Promise<void> {
  try {
    if (result.filePath) {
      await desktopOpenFilePath(result.filePath);
      return;
    }
    if (result.blobUrl) {
      window.open(result.blobUrl, "_blank", "noopener,noreferrer");
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Could not open file");
  }
}

export function showDownloadSuccessToast(result: DownloadResult): void {
  if (result.blobUrl) scheduleBlobRevoke(result.blobUrl);

  toast.success(`Downloaded ${result.filename}`, {
    duration: DOWNLOAD_TOAST_DURATION_MS,
    action: {
      label: "Open file",
      onClick: () => void openDownloadedFile(result),
    },
    ...(result.filePath
      ? {
          cancel: {
            label: "Open folder",
            onClick: () => {
              void desktopRevealFileInFolder(result.filePath!).catch((err) => {
                toast.error(
                  err instanceof Error ? err.message : "Could not open folder",
                );
              });
            },
          },
        }
      : {}),
  });
}

export function showDownloadAllSuccessToast(results: DownloadResult[]): void {
  for (const result of results) {
    if (result.blobUrl) scheduleBlobRevoke(result.blobUrl);
  }
  const last = results.at(-1);
  if (!last) return;

  toast.success(`Downloaded ${results.length} files`, {
    duration: DOWNLOAD_TOAST_DURATION_MS,
    ...(last.filePath
      ? {
          action: {
            label: "Open folder",
            onClick: () => {
              void desktopRevealFileInFolder(last.filePath!).catch((err) => {
                toast.error(
                  err instanceof Error ? err.message : "Could not open folder",
                );
              });
            },
          },
          cancel: {
            label: "Open file",
            onClick: () => void openDownloadedFile(last),
          },
        }
      : last.blobUrl
        ? {
            action: {
              label: "Open file",
              onClick: () => void openDownloadedFile(last),
            },
          }
        : {}),
  });
}
