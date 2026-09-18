import type {
  AutoInstallResult,
  InstallDecision,
  InstallLogEvent,
} from "./install";

const logHandlers = new Set<(event: InstallLogEvent) => void>();
let activeSource: EventSource | null = null;
let rejectActive: ((err: Error) => void) | null = null;

export function subscribeWebInstallLog(handler: (event: InstallLogEvent) => void): () => void {
  logHandlers.add(handler);
  return () => logHandlers.delete(handler);
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
  };
}

export function runWebInstallStream(opts: {
  accountId?: string;
  decisions?: InstallDecision[];
  wipeConfirmation?: string | null;
  mode?: "install" | "update";
}): Promise<AutoInstallResult> {
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

  const qs = params.toString();
  const url = `/api/install/stream${qs ? `?${qs}` : ""}`;

  return new Promise((resolve, reject) => {
    rejectActive = (err) => reject(err);
    const source = new EventSource(url);
    activeSource = source;
    const settle = () => {
      rejectActive = null;
    };

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
        resolve(toAutoInstallResult(payload));
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
