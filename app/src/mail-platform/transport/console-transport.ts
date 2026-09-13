/**
 * Console-mode transport — delegates to the existing `desktopAwareFetch`.
 *
 * Console mode (desktop app with owner dashboard) routes `/api/email/*`
 * through the Worker via the Tauri bridge (`worker_request`), which
 * attaches the in-memory access token. This thin adapter keeps the
 * existing implementation intact during the migration.
 */
import { desktopAwareFetch } from "@/lib/desktop/api";
import type { MailTransport } from "../types";
import { isWorkerBacked } from "@/lib/desktop/api";

export function createConsoleTransport(): MailTransport {
  return {
    get isWorkerBacked() {
      return isWorkerBacked();
    },
    fetch(path: string, init?: RequestInit): Promise<Response> {
      return desktopAwareFetch(path, init);
    },
  };
}
