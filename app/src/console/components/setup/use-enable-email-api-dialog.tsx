"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { EnableEmailApiDialog } from "@/console/components/setup/EnableEmailApiDialog";
import { isConsoleUnlockRequiredError } from "@/lib/desktop/app-session/errors";
import {
  desktopGetCredentials,
  desktopOpenExternal,
  desktopPushServerToken,
  desktopStartCfOAuth,
  desktopVerifyCfToken,
  explainCfOAuthError,
  explainDesktopError,
  isCloudflareAuthExpired,
  listenCfOAuthResult,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/shell";

export type EnableEmailApiOpenOptions = {
  allowSkip?: boolean;
  onVerified?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  accountId?: string;
  workerUrl?: string;
  workerScriptName?: string;
};

export type EnableEmailApiPasteBridge = {
  /** Resolves true when the token was pushed; false when OAuth was started and push is deferred. */
  handlePasteAndPush: (token: string) => Promise<boolean>;
  pasteBusy: boolean;
  pasteError: DesktopErrorHelp | null;
  pasteMessage: string | null;
  cfInstallTokenAvailable: boolean;
  oauthBusy: boolean;
};

type EnableEmailApiContextValue = {
  openEnableEmailApiDialog: (opts?: EnableEmailApiOpenOptions) => void;
};

const EnableEmailApiContext = createContext<EnableEmailApiContextValue | null>(
  null,
);

let openImpl: ((opts?: EnableEmailApiOpenOptions) => void) | null = null;
let pasteBridge: EnableEmailApiPasteBridge | null = null;
const pasteListeners = new Set<() => void>();

/** Open the shared dialog from stores or non-React code. */
export function openEnableEmailApiDialog(opts?: EnableEmailApiOpenOptions) {
  openImpl?.(opts);
}

/** Settings (or other paste owners) register so the host can reuse their flow. */
export function registerEnableEmailApiPasteBridge(
  bridge: EnableEmailApiPasteBridge | null,
) {
  pasteBridge = bridge;
  for (const listener of pasteListeners) listener();
}

function useEnableEmailApiPasteBridge() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    pasteListeners.add(listener);
    return () => {
      pasteListeners.delete(listener);
    };
  }, []);
  return pasteBridge;
}

export function isEmailApiNotConfiguredError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("cloudflare email sending is not configured") ||
    m.includes("cloudflare api is not configured") ||
    m.includes("add a cf_api_token") ||
    m.includes("cf_api_token secret") ||
    m.includes("cf_account_id") ||
    (m.includes("could not configure inbox") &&
      (m.includes("not configured") ||
        m.includes("api token") ||
        m.includes("ops-dashboard")))
  );
}

export function toastEmailApiAwareError(message: string) {
  if (isConsoleUnlockRequiredError(message)) {
    toast.error(message, {
      duration: Infinity,
      closeButton: true,
      action: {
        label: "Unlock dashboard",
        onClick: () => {
          if (typeof window === "undefined") return;
          window.dispatchEvent(
            new CustomEvent("relaybase:console-unauthorized"),
          );
        },
      },
    });
    return;
  }
  if (isEmailApiNotConfiguredError(message)) {
    toast.error(message, {
      duration: Infinity,
      closeButton: true,
      action: {
        label: "Enable email API",
        onClick: () => openEnableEmailApiDialog(),
      },
    });
    return;
  }
  toast.error(message);
}

export function useOpenEnableEmailApiDialog() {
  const ctx = useContext(EnableEmailApiContext);
  return ctx?.openEnableEmailApiDialog ?? openEnableEmailApiDialog;
}

export function EnableEmailApiDialogHost({ children }: { children: ReactNode }) {
  const desktop = useOptionalDesktop();
  const credentials = desktop?.credentials ?? null;
  const settingsPaste = useEnableEmailApiPasteBridge();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<EnableEmailApiOpenOptions>({});
  const optsRef = useRef<EnableEmailApiOpenOptions>({});
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<DesktopErrorHelp | null>(null);
  const [hostPasteMessage, setHostPasteMessage] = useState<string | null>(null);
  const [hostOauthBusy, setHostOauthBusy] = useState(false);
  const pendingPasteTokenRef = useRef<string | null>(null);

  const openDialog = useCallback((next?: EnableEmailApiOpenOptions) => {
    const resolved = next ?? {};
    optsRef.current = resolved;
    setOpts(resolved);
    setPasteError(null);
    setHostPasteMessage(null);
    setOpen(true);
  }, []);

  function finishVerified(message: string) {
    setHostPasteMessage(message);
    toast.success(message);
    optsRef.current.onVerified?.();
    setOpen(false);
  }

  useEffect(() => {
    openImpl = openDialog;
    return () => {
      if (openImpl === openDialog) openImpl = null;
    };
  }, [openDialog]);

  const accountId =
    opts.accountId?.trim() ||
    credentials?.accountId?.trim() ||
    credentials?.cfOauthAccountId?.trim() ||
    "";
  const workerUrl =
    opts.workerUrl?.trim() || credentials?.workerUrl?.trim() || "";
  const workerScriptName =
    opts.workerScriptName?.trim() ||
    credentials?.workerScriptName?.trim() ||
    "relaybase-api";

  const cfInstallTokenAvailable = Boolean(
    settingsPaste?.cfInstallTokenAvailable ||
      credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );

  async function startHostOauth() {
    setHostOauthBusy(true);
    setPasteError(null);
    try {
      const start = await desktopStartCfOAuth();
      await desktopOpenExternal(start.authorizeUrl);
    } catch (err) {
      setHostOauthBusy(false);
      setPasteError(explainCfOAuthError(err));
      throw err;
    }
  }

  async function runDefaultPaste(token: string, acctOverride?: string) {
    const acctId =
      acctOverride?.trim() ||
      accountId ||
      credentials?.accountId?.trim() ||
      credentials?.cfOauthAccountId?.trim() ||
      "";
    if (!acctId) {
      throw new Error("Authorize with Cloudflare first to push the server token.");
    }
    setPasteBusy(true);
    setPasteError(null);
    try {
      const result = await desktopVerifyCfToken(acctId, token, "server");
      if (!result.ok) throw new Error(result.message);
      const push = await desktopPushServerToken(token);
      if (!push.ok) throw new Error(push.message);
      await desktop?.refresh();
      return push.pushedAt
        ? "Server token verified and pushed to the Worker."
        : "Server token verified.";
    } finally {
      setPasteBusy(false);
    }
  }

  async function handleDefaultPaste(token: string): Promise<boolean> {
    const hasSession = Boolean(
      credentials?.cfOauthRefreshToken?.trim() ||
        credentials?.cfOauthAccessToken?.trim(),
    );
    if (!hasSession) {
      pendingPasteTokenRef.current = token;
      await startHostOauth();
      return false;
    }
    try {
      finishVerified(await runDefaultPaste(token));
      return true;
    } catch (err) {
      if (isCloudflareAuthExpired(err)) {
        pendingPasteTokenRef.current = token;
        await startHostOauth();
        return false;
      }
      setPasteError(explainDesktopError(err, "Server token verification failed"));
      throw err;
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;
    listenCfOAuthResult({
      onComplete: () => {
        if (!active) return;
        const token = pendingPasteTokenRef.current;
        pendingPasteTokenRef.current = null;
        setHostOauthBusy(false);
        if (!token) return;
        void (async () => {
          await desktop?.refresh();
          try {
            const fresh = await desktopGetCredentials();
            finishVerified(await runDefaultPaste(token, fresh?.accountId));
          } catch (err) {
            if (isCloudflareAuthExpired(err)) return;
            setPasteError(
              explainDesktopError(err, "Server token verification failed"),
            );
          }
        })();
      },
      onError: (message) => {
        if (!active) return;
        const hadPending = Boolean(pendingPasteTokenRef.current);
        pendingPasteTokenRef.current = null;
        setHostOauthBusy(false);
        if (hadPending) {
          setPasteError(explainCfOAuthError(message));
        }
      },
    }).then((fn) => {
      if (active) unlisten = fn;
      else fn();
    });
    return () => {
      active = false;
      unlisten?.();
    };
    // Default paste OAuth is only used when Settings is not mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      pendingPasteTokenRef.current = null;
      setHostOauthBusy(false);
      optsRef.current.onClose?.();
    }
  }

  const rawPasteError = settingsPaste?.pasteError ?? pasteError;
  const visiblePasteError = isCloudflareAuthExpired(rawPasteError)
    ? null
    : rawPasteError;

  const value: EnableEmailApiContextValue = {
    openEnableEmailApiDialog: openDialog,
  };

  return (
    <EnableEmailApiContext.Provider value={value}>
      {children}
      <EnableEmailApiDialog
        open={open}
        onOpenChange={handleOpenChange}
        accountId={accountId}
        workerScriptName={workerScriptName}
        workerUrl={workerUrl}
        allowSkip={opts.allowSkip}
        onVerified={() => {
          optsRef.current.onVerified?.();
          setOpen(false);
        }}
        onSkip={() => {
          optsRef.current.onSkip?.();
          setOpen(false);
        }}
        onPasteAndPush={
          settingsPaste?.handlePasteAndPush ?? handleDefaultPaste
        }
        pasteBusy={settingsPaste?.pasteBusy ?? pasteBusy}
        pasteError={visiblePasteError}
        pasteMessage={settingsPaste?.pasteMessage ?? hostPasteMessage}
        cfInstallTokenAvailable={cfInstallTokenAvailable}
        oauthBusy={settingsPaste?.oauthBusy ?? hostOauthBusy}
      />
    </EnableEmailApiContext.Provider>
  );
}
