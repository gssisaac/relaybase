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
import {
  desktopPushServerToken,
  desktopSaveCfCredentials,
  desktopVerifyCfToken,
  explainDesktopError,
  type DesktopErrorHelp,
} from "@/lib/desktop/bridge";
import { useOptionalDesktop } from "@/lib/desktop/DesktopContext";

export type EnableEmailApiOpenOptions = {
  allowSkip?: boolean;
  onVerified?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  accountId?: string;
  workerUrl?: string;
  adminToken?: string;
  workerScriptName?: string;
};

export type EnableEmailApiPasteBridge = {
  handlePasteAndPush: (token: string) => Promise<void>;
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
    (m.includes("could not configure inbox") &&
      (m.includes("not configured") ||
        m.includes("api token") ||
        m.includes("ops-dashboard")))
  );
}

export function toastEmailApiAwareError(message: string) {
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

  const openDialog = useCallback((next?: EnableEmailApiOpenOptions) => {
    const resolved = next ?? {};
    optsRef.current = resolved;
    setOpts(resolved);
    setPasteError(null);
    setOpen(true);
  }, []);

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
  const adminToken =
    opts.adminToken?.trim() || credentials?.adminToken?.trim() || "";
  const workerScriptName =
    opts.workerScriptName?.trim() ||
    credentials?.workerScriptName?.trim() ||
    "relaybase-api";

  const cfInstallTokenAvailable = Boolean(
    settingsPaste?.cfInstallTokenAvailable ||
      credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim() ||
      credentials?.installToken?.trim(),
  );

  async function handleDefaultPaste(token: string) {
    if (!accountId) {
      throw new Error("Authorize with Cloudflare first to push the server token.");
    }
    setPasteBusy(true);
    setPasteError(null);
    try {
      const result = await desktopVerifyCfToken(accountId, token, "server");
      if (!result.ok) throw new Error(result.message);
      await desktopSaveCfCredentials(accountId, "", token);
      const push = await desktopPushServerToken();
      if (!push.ok) throw new Error(push.message);
      await desktop?.refresh();
    } catch (err) {
      setPasteError(explainDesktopError(err, "Server token verification failed"));
      throw err;
    } finally {
      setPasteBusy(false);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      optsRef.current.onClose?.();
    }
  }

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
        adminToken={adminToken}
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
        pasteError={settingsPaste?.pasteError ?? pasteError}
        pasteMessage={settingsPaste?.pasteMessage ?? null}
        cfInstallTokenAvailable={cfInstallTokenAvailable}
        oauthBusy={settingsPaste?.oauthBusy ?? false}
      />
    </EnableEmailApiContext.Provider>
  );
}
