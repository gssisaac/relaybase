import type {
  AutoInstallResult,
  InstallDecision,
  InstallLogEvent,
} from "./install";
import type {
  InstallModuleEvent,
  InstallModuleId,
  InstallModuleStatus,
} from "@/features/auth/lib/signup-install-modules";

export type { InstallModuleEvent, InstallModuleId, InstallModuleStatus };

const logHandlers = new Set<(event: InstallLogEvent) => void>();
const moduleHandlers = new Set<(event: InstallModuleEvent) => void>();
let activeSource: EventSource | null = null;
let rejectActive: ((err: Error) => void) | null = null;

export function subscribeWebInstallLog(handler: (event: InstallLogEvent) => void): () => void {
  logHandlers.add(handler);
  return () => logHandlers.delete(handler);
}

export function subscribeWebInstallModule(
  handler: (event: InstallModuleEvent) => void,
): () => void {
  moduleHandlers.add(handler);
  return () => moduleHandlers.delete(handler);
}

function emitModule(event: InstallModuleEvent) {
  for (const h of moduleHandlers) h(event);
}

function emitLog(step: string, level: "info" | "stderr", line: string) {
  const event: InstallLogEvent = {
    step,
    level: level === "stderr" ? "stderr" : "info",
    line,
  };
  for (const h of logHandlers) h(event);
}

function closeActiveStream() {
  activeSource?.close();
  activeSource = null;
}

export function cancelWebInstallStream() {
  if (rejectActive) {
    rejectActive(new Error("INSTALL_CANCELLED"));
    rejectActive = null;
  }
  closeActiveStream();
}

type StreamDone = {
  workerUrl: string;
  workerScriptName: string;
  authPepper?: string;
  r2Bucket?: string;
  d1LogsId?: string;
  d1MailId?: string;
  d1DbId?: string;
  dbAlreadyInitialized?: boolean;
  dbApplied?: string[];
  workerVersion?: string;
  ownerAlreadyConfigured?: boolean;
  cloudSignupReady?: boolean;
  installToken?: string;
  accountId?: string;
};

export type CloudInstallSignupResult = AutoInstallResult & {
  installToken: string;
  cfAccountId: string;
};

function toAutoInstallResult(payload: StreamDone): AutoInstallResult {
  return {
    workerUrl: payload.workerUrl,
    workerScriptName: payload.workerScriptName || "relaybase-api",
    authPepper: payload.authPepper?.trim() || undefined,
    r2Bucket: payload.r2Bucket ?? "",
    d1LogsId: payload.d1LogsId ?? "",
    d1MailId: payload.d1MailId ?? "",
    d1InboxIndexId: payload.d1MailId ?? "",
    d1DbId: payload.d1DbId ?? "",
    dbAlreadyInitialized: Boolean(payload.dbAlreadyInitialized),
    dbApplied: payload.dbApplied ?? [],
    workerVersion: payload.workerVersion ?? "",
    ownerAlreadyConfigured: Boolean(payload.ownerAlreadyConfigured),
  };
}

export function runWebInstallStream(opts: {
  accountId?: string;
  decisions?: InstallDecision[];
  wipeConfirmation?: string | null;
  mode?: "install" | "update";
  cloudSignup?: boolean;
}): Promise<AutoInstallResult | CloudInstallSignupResult> {
  closeActiveStream();

  const params = new URLSearchParams();
  if (opts.accountId?.trim()) params.set("accountId", opts.accountId.trim());
  if (opts.mode === "update") params.set("mode", "update");
  if (opts.decisions?.length) {
    params.set("decisions", JSON.stringify(opts.decisions));
  }
  if (opts.wipeConfirmation?.trim()) {
    params.set("wipeConfirmation", opts.wipeConfirmation.trim());
  }
  if (opts.cloudSignup) {
    params.set("cloudSignup", "1");
  }

  const qs = params.toString();
  const url = `/api/install/stream${qs ? `?${qs}` : ""}`;

  return new Promise((resolve, reject) => {
    rejectActive = (err) => reject(err);
    const source = new EventSource(url);
    activeSource = source;
    const settle = () => {
      rejectActive = null;
    };

    source.addEventListener("module", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as InstallModuleEvent;
        if (data.id && data.status) emitModule(data);
      } catch {
        /* ignore malformed module event */
      }
    });

    source.addEventListener("log", (e) => {
      try {
        const data = JSON.parse((e as MessageEvent).data) as {
          step: string;
          level: "info" | "stderr";
          line: string;
        };
        emitLog(data.step, data.level, data.line);
      } catch {
        /* ignore malformed log */
      }
    });

    source.addEventListener("done", (e) => {
      closeActiveStream();
      settle();
      try {
        const payload = JSON.parse((e as MessageEvent).data) as StreamDone;
        const base = toAutoInstallResult(payload);
        if (opts.cloudSignup && payload.installToken) {
          resolve({
            ...base,
            installToken: payload.installToken,
            cfAccountId: payload.accountId ?? opts.accountId ?? "",
          });
          return;
        }
        resolve(base);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Invalid install done payload"));
      }
    });

    source.addEventListener("error", (e) => {
      closeActiveStream();
      settle();
      const raw = (e as MessageEvent).data;
      if (raw) {
        try {
          const data = JSON.parse(raw) as { error?: string };
          reject(new Error(data.error ?? "Install failed"));
          return;
        } catch {
          /* fall through */
        }
      }
      reject(new Error("Connection to the install stream was lost"));
    });
  });
}
