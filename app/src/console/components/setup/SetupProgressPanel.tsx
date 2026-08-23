"use client";

import { Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cloudflareInstallDashboardLinks,
  cloudflareR2DashboardUrl,
  desktopAutoInstallWorker,
  desktopCancelAutoInstall,
  desktopInitWorkerDb,
  desktopOpenExternal,
  desktopSaveDownloadFile,
  isDesktopRuntime,
  desktopProbeInstall,
  desktopRefreshInstallToken,
  desktopRollbackInstall,
  desktopPushServerToken,
  desktopRegisterWorkerWithConsole,
  desktopSaveCfCredentials,
  desktopSaveWorkerConnection,
  desktopVerifyCfToken,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  isInstallCancelledError,
  listenInstallLog,
  stripAnsi,
  type AutoInstallResult,
  type DesktopErrorHelp,
  type InstallDecision,
  type InstallLogEvent,
  type InstallResourceProbe,
  type WorkerConnectResult,
} from "@/lib/desktop/bridge";
import { downloadBlob } from "@/lib/attachments/download";
import { DesktopErrorBanner } from "@/lib/desktop/DesktopErrorBanner";
import { useDesktop } from "@/lib/desktop/DesktopContext";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import {
  InstallWipeConfirmDialog,
  occupancySummary,
  resourceIsOccupied,
  wipePhraseIsValid,
} from "@/console/components/setup/InstallWipeConfirmDialog";
import { EnableEmailApiDialog } from "@/console/components/setup/EnableEmailApiDialog";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";

type WipeIntent =
  | { kind: "rollback" }
  | { kind: "reinstall-one"; key: string }
  | { kind: "reinstall-all" }
  | { kind: "clear-db" }
  | { kind: "continue"; plan: InstallDecision[] };

function unknownOccupiedTargets(): InstallResourceProbe[] {
  return [
    {
      kind: "r2",
      name: "relaybase-mailbox",
      present: true,
      id: "",
      occupied: true,
      objectCount: null,
    },
    {
      kind: "d1",
      name: "relaybase-db",
      present: true,
      id: "",
      occupied: true,
      rowCount: null,
    },
  ];
}

function wipePhraseCovers(
  phrase: string | null,
  names: string[],
): boolean {
  if (names.length === 0) return true;
  if (!phrase) return false;
  return wipePhraseIsValid(phrase, names);
}

function resourceKindLabel(kind: string): "Worker" | "R2" | "D1" {
  if (kind === "r2") return "R2";
  if (kind === "d1") return "D1";
  return "Worker";
}

function isR2InactiveError(error: DesktopErrorHelp | null): boolean {
  return Boolean(error?.title.toLowerCase().includes("r2 is not active"));
}

function fireInstallConfetti() {
  void import("canvas-confetti").then(({ default: confetti }) => {
    const defaults = {
      startVelocity: 28,
      spread: 360,
      ticks: 90,
      zIndex: 9999,
      particleCount: 80,
    };
    const origins = [
      { x: 0.5, y: 0.45 },
      { x: 0.2, y: 0.55 },
      { x: 0.8, y: 0.55 },
    ];
    for (const [i, origin] of origins.entries()) {
      window.setTimeout(() => {
        confetti({ ...defaults, origin });
      }, i * 220);
    }
  });
}

export function SetupProgressPanel() {
  const router = useRouter();
  const { refresh, credentials } = useDesktop();
  const [probing, setProbing] = useState(false);
  const [existing, setExisting] = useState<InstallResourceProbe[]>([]);
  const [decisions, setDecisions] = useState<Record<string, "skip" | "reinstall">>(
    {},
  );
  const [busy, setBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [rolledBack, setRolledBack] = useState(false);
  const [error, setError] = useState<DesktopErrorHelp | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<InstallLogEvent[]>([]);
  const [autoDone, setAutoDone] = useState<{
    workerUrl: string;
    adminToken: string;
  } | null>(null);
  const [pendingVerify, setPendingVerify] = useState<{
    workerUrl: string;
    adminToken: string;
    workerVersion: string;
    dbAlreadyInitialized: boolean;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<DesktopErrorHelp | null>(null);
  const [dbAlreadyInit, setDbAlreadyInit] = useState<{
    workerUrl: string;
    adminToken: string;
  } | null>(null);
  const [clearingDb, setClearingDb] = useState(false);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeIntent, setWipeIntent] = useState<WipeIntent | null>(null);
  const [wipeTargets, setWipeTargets] = useState<InstallResourceProbe[]>([]);
  const [wipeProbing, setWipeProbing] = useState(false);
  const [lastWipePhrase, setLastWipePhrase] = useState<string | null>(null);
  const [confirmedReinstallKeys, setConfirmedReinstallKeys] = useState<
    Set<string>
  >(() => new Set());
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const [emailApiOpen, setEmailApiOpen] = useState(false);
  const [mailApiDone, setMailApiDone] = useState(false);
  const [mailApiVerified, setMailApiVerified] = useState(false);
  const [pasteBusy, setPasteBusy] = useState(false);
  const [pasteError, setPasteError] = useState<DesktopErrorHelp | null>(null);
  const emailDialogShownRef = useRef(false);
  const [installLogExpanded, setInstallLogExpanded] = useState(false);
  const [r2DashboardOpened, setR2DashboardOpened] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const installStartedRef = useRef(false);
  const busyRef = useRef(false);

  const cfOAuthConnected = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
  const cfOAuthAccountId =
    credentials?.cfOauthAccountId?.trim() ||
    credentials?.accountId?.trim() ||
    "";

  async function ensureOauthSession() {
    if (!cfOAuthConnected) {
      setError({
        title: "Connect Cloudflare first",
        detail:
          "Authorize Relaybase with Cloudflare before installing. There is no token to paste.",
        fix: "Go back and click Authorize and install on Cloudflare.",
      });
      return false;
    }
    try {
      await desktopRefreshInstallToken();
    } catch (err) {
      const raw = String(err ?? "");
      if (
        raw.toLowerCase().includes("cloudflare_auth_expired") ||
        raw.toLowerCase().includes("invalid access token")
      ) {
        throw err;
      }
    }
    return true;
  }

  useEffect(() => {
    if (logEndRef.current && (!autoDone || installLogExpanded)) {
      logEndRef.current.scrollTop = logEndRef.current.scrollHeight;
    }
  }, [logs, autoDone, installLogExpanded]);

  useEffect(() => {
    if (!copiedToken) return;
    const t = window.setTimeout(() => setCopiedToken(false), 2000);
    return () => window.clearTimeout(t);
  }, [copiedToken]);

  useEffect(() => {
    if (autoDone && !mailApiDone && !emailDialogShownRef.current) {
      emailDialogShownRef.current = true;
      setEmailApiOpen(true);
    }
    if (!autoDone) {
      setTokenDownloaded(false);
      return;
    }
    setInstallLogExpanded(false);
    fireInstallConfetti();
  }, [autoDone]);

  useEffect(() => {
    if (!credentials) return;
    if (!cfOAuthConnected) {
      router.replace("/setup/install");
      return;
    }
    if (installStartedRef.current) return;
    installStartedRef.current = true;
    void startFlow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [credentials, cfOAuthConnected]);

  async function stopInstall() {
    if (!busyRef.current || stopping) return;
    setStopping(true);
    try {
      await desktopCancelAutoInstall();
    } catch {
      /* install promise rejects when cancel lands */
    }
  }

  function decisionKey(r: Pick<InstallResourceProbe, "kind" | "name">) {
    return `${r.kind}:${r.name}`;
  }

  async function startFlow() {
    setProbing(true);
    setError(null);
    setR2DashboardOpened(false);
    setStopped(false);
    setRolledBack(false);
    setAutoDone(null);
    setPendingVerify(null);
    setVerifyError(null);
    setExisting([]);
    setLastWipePhrase(null);
    setConfirmedReinstallKeys(new Set());
    try {
      if (!(await ensureOauthSession())) {
        return;
      }
      const probe = await desktopProbeInstall(cfOAuthAccountId || undefined);
      const found = probe.resources.filter((r) => r.present);
      if (found.length === 0) {
        setProbing(false);
        await runAutoInstall([]);
        return;
      }
      setExisting(found);
      setDecisions(
        Object.fromEntries(found.map((r) => [decisionKey(r), "skip" as const])),
      );
    } catch (err) {
      setError(
        explainDesktopError(err, "Could not check existing resources", {
          accountId: cfOAuthAccountId,
        }),
      );
    } finally {
      setProbing(false);
    }
  }

  function setAllDecisions(action: "skip" | "reinstall") {
    setDecisions(
      Object.fromEntries(existing.map((r) => [decisionKey(r), action])),
    );
  }

  async function finishInstall(
    result: AutoInstallResult,
    connect: WorkerConnectResult,
  ) {
    await desktopSaveWorkerConnection({
      workerUrl: connect.workerUrl,
      adminToken: result.adminToken,
      workerScriptName: connect.workerScriptName,
      workerVersion: result.workerVersion || connect.version,
    });
    void desktopRegisterWorkerWithConsole(connect.workerUrl).catch(() => {
      /* best-effort */
    });
    await refresh();
    setPendingVerify(null);
    setVerifyError(null);
    if (result.dbAlreadyInitialized) {
      setDbAlreadyInit({
        workerUrl: connect.workerUrl,
        adminToken: result.adminToken,
      });
    } else {
      setAutoDone({
        workerUrl: connect.workerUrl,
        adminToken: result.adminToken,
      });
      setMessage(`Connected to ${connect.workerUrl}`);
    }
  }

  async function runManualVerify() {
    if (!pendingVerify || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await desktopInitWorkerDb(
        pendingVerify.workerUrl,
        pendingVerify.adminToken,
        false,
      );
      const connect = await desktopVerifyWorkerConnection(
        pendingVerify.workerUrl,
        pendingVerify.adminToken,
      );
      await finishInstall(
        {
          workerUrl: pendingVerify.workerUrl,
          adminToken: pendingVerify.adminToken,
          workerScriptName: connect.workerScriptName,
          r2Bucket: "",
          d1LogsId: "",
          d1InboxIndexId: "",
          d1DbId: "",
          dbAlreadyInitialized: pendingVerify.dbAlreadyInitialized,
          dbApplied: [],
          workerVersion: pendingVerify.workerVersion,
        },
        connect,
      );
    } catch (err) {
      setVerifyError(
        explainDesktopError(err, "Worker is not responding yet"),
      );
    } finally {
      setVerifying(false);
    }
  }

  function openWipe(intent: WipeIntent, targets: InstallResourceProbe[]) {
    setWipeIntent(intent);
    setWipeTargets(targets);
    setWipeOpen(true);
  }

  async function runAutoInstall(
    plan?: InstallDecision[],
    wipeConfirmation?: string | null,
  ) {
    busyRef.current = true;
    setBusy(true);
    setStopping(false);
    setStopped(false);
    setRollingBack(false);
    setRolledBack(false);
    setError(null);
    setMessage(null);
    setLogs([]);
    setAutoDone(null);
    setPendingVerify(null);
    setVerifyError(null);
    const chosen =
      plan ??
      existing.map((r) => ({
        kind: r.kind,
        name: r.name,
        action: decisions[decisionKey(r)] ?? "skip",
      }));
    if (!(await ensureOauthSession())) {
      busyRef.current = false;
      setBusy(false);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      const result = await desktopAutoInstallWorker(
        cfOAuthAccountId || undefined,
        undefined,
        chosen,
        wipeConfirmation,
      );
      try {
        const connect = await desktopVerifyWorkerConnection(
          result.workerUrl,
          result.adminToken,
        );
        await finishInstall(result, connect);
      } catch {
        setPendingVerify({
          workerUrl: result.workerUrl,
          adminToken: result.adminToken,
          workerVersion: result.workerVersion,
          dbAlreadyInitialized: result.dbAlreadyInitialized,
        });
        setError(null);
      }
    } catch (err) {
      if (isInstallCancelledError(err)) {
        setStopped(true);
        setError(null);
      } else {
        setError(
          explainDesktopError(err, "Auto-install failed", {
            accountId: cfOAuthAccountId,
          }),
        );
      }
    } finally {
      if (unlisten) unlisten();
      busyRef.current = false;
      setBusy(false);
      setStopping(false);
    }
  }

  async function requestRollback() {
    if (rollingBack || busyRef.current || wipeProbing) return;
    setWipeProbing(true);
    setError(null);
    try {
      if (!(await ensureOauthSession())) {
        return;
      }
      const probe = await desktopProbeInstall(cfOAuthAccountId || undefined);
      openWipe(
        { kind: "rollback" },
        probe.resources.filter((r) => r.present),
      );
    } catch (err) {
      openWipe({ kind: "rollback" }, unknownOccupiedTargets());
      setError(
        explainDesktopError(err, "Could not check existing data before rollback"),
      );
    } finally {
      setWipeProbing(false);
    }
  }

  async function runRollback(wipeConfirmation?: string | null) {
    if (rollingBack || busyRef.current) return;
    setRollingBack(true);
    setError(null);
    if (!(await ensureOauthSession())) {
      setRollingBack(false);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      await desktopRollbackInstall(
        cfOAuthAccountId || undefined,
        wipeConfirmation,
      );
      setRolledBack(true);
      setAutoDone(null);
      setPendingVerify(null);
      setVerifyError(null);
      setStopped(false);
      setMessage(null);
      await refresh();
    } catch (err) {
      setError(explainDesktopError(err, "Rollback failed"));
    } finally {
      if (unlisten) unlisten();
      setRollingBack(false);
    }
  }

  async function copyAutoToken() {
    if (!autoDone?.adminToken) return;
    await navigator.clipboard.writeText(autoDone.adminToken);
    setCopiedToken(true);
  }

  async function handleSetupPasteServerToken(token: string) {
    const acctId = cfOAuthAccountId;
    if (!acctId) {
      throw new Error("Authorize with Cloudflare first to push the server token.");
    }
    setPasteBusy(true);
    setPasteError(null);
    try {
      const result = await desktopVerifyCfToken(acctId, token, "server");
      if (!result.ok) throw new Error(result.message);
      await desktopSaveCfCredentials(acctId, "", token);
      const push = await desktopPushServerToken();
      if (!push.ok) throw new Error(push.message);
      setMailApiVerified(true);
      setMailApiDone(true);
    } catch (err) {
      setPasteError(explainDesktopError(err, "Server token verification failed"));
      throw err;
    } finally {
      setPasteBusy(false);
    }
  }

  async function downloadAutoToken() {
    if (!autoDone?.adminToken) return;
    const content = [
      "# Relaybase admin token — save this file securely",
      `# Worker URL: ${autoDone.workerUrl}`,
      `# Generated: ${new Date().toISOString()}`,
      "",
      `ADMIN_TOKEN=${autoDone.adminToken}`,
      "",
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const filename = "relaybase-admin-token.txt";
    if (isDesktopRuntime()) {
      const buffer = await blob.arrayBuffer();
      await desktopSaveDownloadFile(filename, new Uint8Array(buffer));
    } else {
      downloadBlob(blob, filename);
    }
    setTokenDownloaded(true);
  }

  async function requestClearDb() {
    if (!dbAlreadyInit || clearingDb || wipeProbing) return;
    setWipeProbing(true);
    setError(null);
    try {
      if (!(await ensureOauthSession())) {
        return;
      }
      const probe = await desktopProbeInstall(cfOAuthAccountId || undefined);
      const d1 = probe.resources.filter((r) => r.kind === "d1" && r.present);
      openWipe(
        { kind: "clear-db" },
        d1.length > 0 ? d1 : unknownOccupiedTargets().filter((r) => r.kind === "d1"),
      );
    } catch (err) {
      openWipe(
        { kind: "clear-db" },
        unknownOccupiedTargets().filter((r) => r.kind === "d1"),
      );
      setError(
        explainDesktopError(err, "Could not check existing database data"),
      );
    } finally {
      setWipeProbing(false);
    }
  }

  function requestContinueInstall() {
    const plan = existing.map((r) => ({
      kind: r.kind,
      name: r.name,
      action: decisions[decisionKey(r)] ?? "skip",
    }));
    const occupiedReinstall = existing.filter(
      (r) =>
        resourceIsOccupied(r) &&
        (decisions[decisionKey(r)] ?? "skip") === "reinstall",
    );
    const names = occupiedReinstall.map((r) => r.name);
    const allConfirmed = occupiedReinstall.every((r) =>
      confirmedReinstallKeys.has(decisionKey(r)),
    );
    if (
      occupiedReinstall.length > 0 &&
      (!allConfirmed || !wipePhraseCovers(lastWipePhrase, names))
    ) {
      openWipe({ kind: "continue", plan }, occupiedReinstall);
      return;
    }
    setExisting([]);
    void runAutoInstall(plan, lastWipePhrase);
  }

  function requestReinstallOne(r: InstallResourceProbe) {
    const key = decisionKey(r);
    if (resourceIsOccupied(r)) {
      openWipe({ kind: "reinstall-one", key }, [r]);
      return;
    }
    setDecisions((prev) => ({ ...prev, [key]: "reinstall" }));
  }

  function requestReinstallAll() {
    const occupied = existing.filter(resourceIsOccupied);
    if (occupied.length > 0) {
      openWipe({ kind: "reinstall-all" }, occupied);
      return;
    }
    setAllDecisions("reinstall");
  }

  function onWipeConfirm(phrase: string | null) {
    setLastWipePhrase(phrase);
    const intent = wipeIntent;
    setWipeOpen(false);
    if (!intent) return;
    if (intent.kind === "rollback") {
      void runRollback(phrase);
      return;
    }
    if (intent.kind === "reinstall-one") {
      setDecisions((prev) => ({ ...prev, [intent.key]: "reinstall" }));
      setConfirmedReinstallKeys((prev) => {
        const next = new Set(prev);
        next.add(intent.key);
        return next;
      });
      return;
    }
    if (intent.kind === "reinstall-all") {
      setAllDecisions("reinstall");
      setConfirmedReinstallKeys(new Set(existing.map((r) => decisionKey(r))));
      return;
    }
    if (intent.kind === "continue") {
      setExisting([]);
      void runAutoInstall(intent.plan, phrase);
      return;
    }
    void confirmClearDb(true, phrase);
  }

  function wipeDialogCopy(): {
    title: string;
    description: string;
    confirmLabel: string;
  } {
    switch (wipeIntent?.kind) {
      case "rollback":
        return {
          title: "Rollback this install?",
          description:
            "This deletes the Relaybase Worker, D1 databases, and R2 mailbox bucket in this Cloudflare account. If this is a live mailbox, mail and product data are gone permanently.",
          confirmLabel: "Rollback",
        };
      case "clear-db":
        return {
          title: "Clear the database?",
          description:
            "This drops every D1 table and starts empty. Domains, addresses, audience lists, API keys, and settings will be deleted.",
          confirmLabel: "Clear database",
        };
      case "continue":
        return {
          title: "Delete existing data and continue?",
          description:
            "Continue install will delete the resources marked Reinstall. Mail in R2 and rows in D1 cannot be recovered.",
          confirmLabel: "Delete and continue",
        };
      default:
        return {
          title: "Reinstall will delete existing data",
          description:
            "Reinstall deletes this resource and creates a new empty one. If this account is already running Relaybase, that data is gone permanently.",
          confirmLabel: "Reinstall",
        };
    }
  }

  async function confirmClearDb(
    clear: boolean,
    wipeConfirmation?: string | null,
  ) {
    if (!dbAlreadyInit || clearingDb) return;
    if (clear) {
      setClearingDb(true);
      try {
        await desktopInitWorkerDb(
          dbAlreadyInit.workerUrl,
          dbAlreadyInit.adminToken,
          true,
          wipeConfirmation,
          cfOAuthAccountId || undefined,
        );
      } catch (err) {
        setError(explainDesktopError(err, "Could not clear database"));
        setClearingDb(false);
        return;
      }
      setClearingDb(false);
    }
    setAutoDone({
      workerUrl: dbAlreadyInit.workerUrl,
      adminToken: dbAlreadyInit.adminToken,
    });
    setMessage(
      clear
        ? "Database cleared and reinitialized"
        : `Connected to ${dbAlreadyInit.workerUrl}`,
    );
    setDbAlreadyInit(null);
  }

  return (
    <SetupScrollPage>
      <div className="flex justify-end">
        <SetupBackLink
          onClick={async () => {
            if (busyRef.current) {
              await desktopCancelAutoInstall();
            }
          }}
        />
      </div>
      <div className="mt-3 space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {autoDone
              ? "Success"
              : pendingVerify
              ? "Verify connection"
              : existing.length > 0 && !busy && !autoDone
              ? "Existing resources"
              : probing
                ? "Checking"
                : "Installing"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {autoDone
              ? "Your Worker is live. Save your admin token before opening the mailbox."
              : pendingVerify
              ? "The Worker was uploaded. Confirm it is responding before continuing."
              : existing.length > 0 && !busy && !autoDone
              ? "Some Relaybase resources already exist in this Cloudflare account. Choose Skip or Reinstall for each, then continue."
              : probing
                ? "Looking for an existing Worker, R2 bucket, and D1 databases before creating anything."
                : "Creating resources and deploying the Worker in your Cloudflare account."}
          </p>
        </div>

        {probing ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Checking for existing Cloudflare resources…
          </div>
        ) : existing.length > 0 &&
          !busy &&
          !autoDone &&
          !pendingVerify &&
          !stopped &&
          !rollingBack &&
          !rolledBack ? (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">
                Existing resources found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                These already exist in your Cloudflare account. Skip keeps
                them. Reinstall on a resource with mail or database rows
                requires typing DELETE ME.
              </p>
            </div>
            <ul className="space-y-3">
              {existing.map((r) => {
                const key = decisionKey(r);
                const action = decisions[key] ?? "skip";
                return (
                  <li
                    key={key}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CloudflareModuleIcon
                        kind={resourceKindLabel(r.kind)}
                        className="size-5 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs">
                          <span className="text-muted-foreground">
                            {resourceKindLabel(r.kind)}
                          </span>{" "}
                          <span className="font-medium">{r.name}</span>
                        </p>
                        {occupancySummary(r) ? (
                          <p
                            className={
                              resourceIsOccupied(r)
                                ? "text-[11px] text-amber-700 dark:text-amber-400"
                                : "text-[11px] text-muted-foreground"
                            }
                          >
                            {occupancySummary(r)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={action === "skip" ? "default" : "outline"}
                        onClick={() => {
                          setDecisions((prev) => ({ ...prev, [key]: "skip" }));
                          setConfirmedReinstallKeys((prev) => {
                            const next = new Set(prev);
                            next.delete(key);
                            return next;
                          });
                        }}
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          action === "reinstall" ? "default" : "outline"
                        }
                        onClick={() => requestReinstallOne(r)}
                      >
                        Reinstall
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAllDecisions("skip");
                  setConfirmedReinstallKeys(new Set());
                }}
              >
                Skip all
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => requestReinstallAll()}
              >
                Reinstall all
              </Button>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => requestContinueInstall()}
            >
              Continue install
            </Button>
          </div>
        ) : rollingBack ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Rolling back — deleting Worker, D1, and R2…
          </div>
        ) : rolledBack ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Rolled back</p>
            <p className="text-xs text-muted-foreground">
              The Worker, D1 databases, and R2 bucket from this install were
              removed from your Cloudflare account.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => void startFlow()}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/setup")}
              >
                Back to start
              </Button>
            </div>
          </div>
        ) : dbAlreadyInit ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
              Database already initialized
            </p>
            <p className="text-xs text-muted-foreground">
              The D1 databases already have tables and data from a previous
              install. Migrations were applied (if any were pending). Do you
              want to keep the existing data, or clear everything and start
              fresh?
            </p>
            {clearingDb ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Clearing database…
              </div>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="flex-1"
                  onClick={() => void requestClearDb()}
                  disabled={wipeProbing}
                >
                  Clear and reinitialize
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => void confirmClearDb(false)}
                >
                  Keep existing data
                </Button>
              </div>
            )}
          </div>
        ) : pendingVerify ? (
          <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Deploy finished — verify connection
            </p>
            <p className="text-xs text-muted-foreground">
              The Worker was uploaded, but Relaybase could not confirm it yet.
              Verify now retries init-db and connect only — it does not
              replace worker.js. If the log mentions error 1104, wait a few
              seconds and Try again. If it says the script is too old, rebuild
              with <code>pnpm run build:bundle</code> in server/.
            </p>
            <p className="text-xs text-muted-foreground">
              Worker URL:{" "}
              <span className="font-mono">{pendingVerify.workerUrl}</span>
            </p>
            {verifyError ? <DesktopErrorBanner error={verifyError} /> : null}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                disabled={verifying}
                onClick={() => void runManualVerify()}
              >
                {verifying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                Verify now
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={verifying}
                onClick={() => void startFlow()}
              >
                Try again
              </Button>
            </div>
          </div>
        ) : autoDone ? (
          <div className="space-y-3 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-4">
            <p className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
              🎉 Installed and connected!
            </p>
            <p className="text-xs text-muted-foreground">
              Worker URL:{" "}
              <span className="font-mono">{autoDone.workerUrl}</span>
            </p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Download and save this admin token — it&apos;s the only way to
                recover your Worker if you lose this Mac. Relaybase cannot
                recover it for you.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[11px]">
                  {autoDone.adminToken}
                </code>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label="Copy admin token"
                  onClick={() => void copyAutoToken()}
                >
                  {copiedToken ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant={tokenDownloaded ? "default" : "outline"}
                  aria-label="Download admin token"
                  onClick={() => void downloadAutoToken()}
                >
                  {tokenDownloaded ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Download className="size-3.5" />
                  )}
                </Button>
              </div>
              {!tokenDownloaded ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Download the token file to unlock Go to Mailbox.
                </p>
              ) : null}
              {!mailApiDone ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Enable the email API on your Worker to unlock Go to Mailbox.
                </p>
              ) : mailApiVerified ? (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  Email API verified on the Worker.
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Email API skipped — finish it later in Settings → Cloudflare.
                </p>
              )}
              {!mailApiDone ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEmailApiOpen(true)}
                >
                  Enable email API
                </Button>
              ) : null}
            </div>
            {cfOAuthAccountId ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Check in Cloudflare</p>
                <p className="text-[11px] text-muted-foreground">
                  Open each resource to confirm it was created in your account.
                </p>
                <ul className="space-y-1.5">
                  {cloudflareInstallDashboardLinks(cfOAuthAccountId).map(
                    (link) => (
                      <li key={link.href}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded-md border border-border bg-background/70 px-2.5 py-2 text-left hover:bg-muted/50"
                          onClick={() => void desktopOpenExternal(link.href)}
                        >
                          <span className="shrink-0 text-[11px] font-medium">
                            {link.label}
                          </span>
                          <span className="min-w-0 flex-1 break-all font-mono text-[10px] text-muted-foreground">
                            {link.href}
                          </span>
                          <ExternalLink className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                        </button>
                      </li>
                    ),
                  )}
                </ul>
              </div>
            ) : null}
            <Button
              type="button"
              className="w-full"
              disabled={!tokenDownloaded || !mailApiDone}
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.assign("/");
                }
              }}
            >
              Go to Mailbox
            </Button>
            <EnableEmailApiDialog
              open={emailApiOpen}
              onOpenChange={setEmailApiOpen}
              accountId={cfOAuthAccountId}
              workerUrl={autoDone.workerUrl}
              adminToken={autoDone.adminToken}
              allowSkip
              onVerified={() => {
                setMailApiVerified(true);
                setMailApiDone(true);
              }}
              onSkip={() => {
                setMailApiVerified(false);
                setMailApiDone(true);
              }}
              onPasteAndPush={handleSetupPasteServerToken}
              pasteBusy={pasteBusy}
              pasteError={pasteError}
              cfInstallTokenAvailable={cfOAuthConnected}
            />
          </div>
        ) : stopped ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-sm font-medium">Installation stopped</p>
            <p className="text-xs text-muted-foreground">
              Install was stopped. Resources already created in Cloudflare are
              still there — use Rollback below to delete them.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                className="flex-1"
                onClick={() => void startFlow()}
              >
                Try again
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/setup")}
              >
                Back to start
              </Button>
            </div>
          </div>
        ) : (
          <>
            {busy ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {stopping
                    ? "Stopping and rolling back…"
                    : "Installing…"}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={stopping}
                  onClick={() => void stopInstall()}
                >
                  <Square className="size-3 fill-current" />
                  Stop
                </Button>
              </div>
            ) : null}
            {message ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {message}
              </p>
            ) : null}
          </>
        )}

        {error && !rollingBack && !pendingVerify ? (
          <DesktopErrorBanner
            error={error}
            hideLinks={isR2InactiveError(error)}
          />
        ) : null}

        {logs.length > 0 || rollingBack ? (
          autoDone && !installLogExpanded ? (
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => setInstallLogExpanded(true)}
            >
              Install log
              <ChevronDown className="size-3.5" />
            </Button>
          ) : (
            <div className="space-y-2 rounded-lg border border-border p-3">
              {autoDone ? (
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => setInstallLogExpanded(false)}
                >
                  Install log
                  <ChevronUp className="size-3.5" />
                </button>
              ) : (
                <p className="text-xs font-medium">Install log</p>
              )}
              <div
                ref={logEndRef}
                className="max-h-56 select-text cursor-text overflow-y-auto rounded bg-black/80 p-3 font-mono text-[11px] leading-relaxed text-emerald-300"
              >
                {logs.map((entry, i) => (
                  <div key={i} className="whitespace-pre-wrap break-all">
                    <span className="text-muted-foreground">
                      [{entry.step}:{entry.level}]
                    </span>{" "}
                    {stripAnsi(entry.line)}
                  </div>
                ))}
              </div>
            </div>
          )
        ) : null}

        {error &&
        !busy &&
        !autoDone &&
        !pendingVerify &&
        !stopped &&
        !rollingBack &&
        !rolledBack &&
        existing.length === 0 ? (
          error.title.toLowerCase().includes("authorization expired") ? (
            <Button
              type="button"
              className="w-full"
              onClick={() => router.push("/setup/install")}
            >
              Authorize again
            </Button>
          ) : isR2InactiveError(error) ? (
            <div className="space-y-2">
              <Button
                type="button"
                variant={r2DashboardOpened ? "outline" : "default"}
                className="w-full"
                onClick={() => {
                  const href =
                    error.links?.[0]?.href ||
                    cloudflareR2DashboardUrl(cfOAuthAccountId);
                  void desktopOpenExternal(href);
                  setR2DashboardOpened(true);
                }}
              >
                Open R2 in Cloudflare
                <ExternalLink className="size-3.5" />
              </Button>
              {r2DashboardOpened ? (
                <Button
                  type="button"
                  className="w-full"
                  onClick={() => void startFlow()}
                >
                  I&apos;ve added R2 — continue
                </Button>
              ) : null}
            </div>
          ) : (
            <Button
              type="button"
              className="w-full"
              onClick={() => void startFlow()}
            >
              Try again
            </Button>
          )
        ) : null}

        {!busy &&
        !stopping &&
        !rollingBack &&
        !rolledBack &&
        (autoDone || pendingVerify || stopped || (error && logs.length > 0)) ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={wipeProbing}
            onClick={() => void requestRollback()}
          >
            {wipeProbing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Rollback
          </Button>
        ) : null}

        <InstallWipeConfirmDialog
          open={wipeOpen}
          onOpenChange={setWipeOpen}
          title={wipeDialogCopy().title}
          description={wipeDialogCopy().description}
          targets={wipeTargets}
          confirmLabel={wipeDialogCopy().confirmLabel}
          onConfirm={onWipeConfirm}
          confirming={rollingBack || clearingDb}
        />

      </div>
    </SetupScrollPage>
  );
}
