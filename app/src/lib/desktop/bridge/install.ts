import type { WorkerUpdateCheck } from "./cloudflare";
import { formatDesktopError, invoke, isDesktopRuntime } from "./invoke";

export type InstallResult = {
  workerUrl: string;
  workerScriptName: string;
  r2Bucket: string;
  skipped: boolean;
  adminRelinked: boolean;
};

export type WorkerUpdateTarget = {
  expectedWorkerUrl: string;
  oauthAccountId: string;
  oauthWorkerUrl: string;
  connectedAccountId: string;
  matches: boolean;
};

export type AutoInstallResult = {
  workerUrl: string;
  workerScriptName: string;
  /** AUTH_PEPPER just set. JS memory only — never persist. Empty on Worker update. */
  authPepper?: string;
  r2Bucket: string;
  d1LogsId: string;
  d1MailId: string;
  /** @deprecated Renamed to d1MailId. Kept for callers being migrated. */
  d1InboxIndexId: string;
  d1DbId: string;
  dbAlreadyInitialized: boolean;
  dbApplied: string[];
  workerVersion: string;
};

export type InitDbResult = {
  ok: boolean;
  alreadyInitialized: boolean;
  applied: string[];
  skipped: string[];
  cleared?: boolean;
};

export type InstallResourceProbe = {
  kind: "worker" | "r2" | "d1" | string;
  name: string;
  present: boolean;
  id: string;
  objectCount?: number | null;
  rowCount?: number | null;
  truncated?: boolean;
  occupied?: boolean;
};

export type InstallProbeResult = {
  accountId: string;
  /** workers.dev URL when the routing Worker script already exists. */
  workersDevUrl?: string | null;
  resources: InstallResourceProbe[];
};

export type InstallDecision = {
  kind: string;
  name: string;
  action: "skip" | "reinstall";
};

export type InstallLogEvent = {
  step: string;
  level: "stdout" | "stderr" | "info";
  line: string;
};

export type ResourceCheck = {
  name: string;
  kind: string;
  present: boolean;
  detail: string;
};

export type ProbeResult = {
  status: "ready" | "partial" | "missing" | string;
  workerScriptName: string;
  workerUrl: string | null;
  healthOk: boolean;
  resources: ResourceCheck[];
  summary: string;
};

export async function desktopProbeWorker(): Promise<ProbeResult> {
  return invoke("probe_routing_worker");
}

export async function desktopAdoptWorker(): Promise<InstallResult> {
  return invoke("adopt_routing_worker");
}

export async function desktopInstallWorker(
  workerJs?: string,
): Promise<InstallResult> {
  return invoke("install_routing_worker", { workerJs: workerJs ?? null });
}

/**
 * Background auto-install of the routing Worker into the user's Cloudflare
 * account via the Cloudflare HTTP API. Auth is the in-memory OAuth session.
 */
export async function desktopProbeInstall(
  accountId?: string,
): Promise<InstallProbeResult> {
  return invoke("probe_auto_install", {
    accountId: accountId ?? null,
  });
}

export async function desktopAutoInstallWorker(
  accountId?: string,
  serverToken?: string,
  decisions?: InstallDecision[],
  wipeConfirmation?: string | null,
): Promise<AutoInstallResult> {
  return invoke("auto_install_routing_worker", {
    accountId: accountId ?? null,
    serverToken: serverToken?.trim() ? serverToken.trim() : null,
    decisions: decisions ?? [],
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
  });
}

/** Compare stored Worker version against relaybase.xyz install manifest. */
export async function desktopCheckWorkerUpdate(): Promise<WorkerUpdateCheck> {
  return invoke("check_worker_update_cmd");
}

/** Compare saved Worker URL with the OAuth account's workers.dev URL. No upload. */
export async function desktopPreviewWorkerUpdateTarget(): Promise<WorkerUpdateTarget> {
  return invoke("preview_worker_update_target_cmd");
}

/** Download latest install ZIP and re-deploy the Worker (keeps D1). */
export async function desktopUpdateInstalledWorker(
  serverToken?: string,
): Promise<AutoInstallResult> {
  return invoke("update_installed_worker_cmd", {
    serverToken: serverToken?.trim() ? serverToken.trim() : null,
  });
}

/** Stop an in-flight auto-install. The install promise then rejects. */
export async function desktopCancelAutoInstall(): Promise<void> {
  await invoke("cancel_auto_install");
}

/** Delete Worker + D1 + R2. Subscribe to `install-log` for the same live log as install. */
export async function desktopRollbackInstall(
  accountId?: string,
  wipeConfirmation?: string | null,
): Promise<void> {
  await invoke("rollback_auto_install", {
    accountId: accountId ?? null,
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
  });
}

/** Empty D1 only. `clear` is rejected by the desktop command. */
export async function desktopInitWorkerDb(
  workerUrl: string,
  clear: boolean,
  wipeConfirmation?: string | null,
  accountId?: string,
): Promise<InitDbResult> {
  return invoke("init_worker_db_cmd", {
    workerUrl,
    clear,
    wipeConfirmation: wipeConfirmation?.trim() ? wipeConfirmation.trim() : null,
    accountId: accountId?.trim() ? accountId.trim() : null,
  });
}

/** Pending migrations only. Never drops tables. */
export async function desktopMigrateWorkerDb(
  workerUrl: string,
): Promise<InitDbResult> {
  return invoke("migrate_worker_db_cmd", {
    workerUrl,
  });
}

export function isInstallCancelledError(err: unknown): boolean {
  return formatDesktopError(err).includes("INSTALL_CANCELLED");
}

/** Subscribe to `install-log` events emitted during auto-install. */
export async function listenInstallLog(
  handler: (event: InstallLogEvent) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) {
    return () => {
      /* no-op outside Tauri */
    };
  }
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return await listen("install-log", (e) => handler(e.payload as InstallLogEvent));
  } catch {
    return () => {
      /* no-op */
    };
  }
}

export async function desktopUpdateWorker(
  workerJs?: string,
): Promise<InstallResult> {
  return invoke("update_routing_worker", { workerJs: workerJs ?? null });
}
