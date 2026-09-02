import { downloadBlob } from "@/lib/attachments/download";
import {
  desktopSaveDownloadFile,
  isDesktopRuntime,
} from "@/lib/desktop/bridge";

import {
  PASSTOKEN_BACKUP_FILENAME,
  passtokenBackupFileContents,
} from "./normalize-passtoken";

/** Save the owner passtoken backup — raw token bytes, nothing else. */
export async function downloadPasstokenBackup(token: string): Promise<void> {
  const content = passtokenBackupFileContents(token);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  if (isDesktopRuntime()) {
    const buffer = await blob.arrayBuffer();
    await desktopSaveDownloadFile(
      PASSTOKEN_BACKUP_FILENAME,
      new Uint8Array(buffer),
    );
    return;
  }
  downloadBlob(blob, PASSTOKEN_BACKUP_FILENAME);
}
