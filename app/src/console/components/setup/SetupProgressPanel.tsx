"use client";

import { Check, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  cloudflareInstallDashboardLinks,
  cloudflareR2DashboardUrl,
  desktopAutoInstallWorker,
  desktopCancelAutoInstall,
  desktopMigrateWorkerDb,
  desktopPreviewWorkerUpdateTarget,
  desktopUpdateInstalledWorker,
  desktopOpenExternal,
  desktopProbeInstall,
  desktopRollbackInstall,
  desktopOwnerSetupAdmin,
  desktopRegisterWorkerWithConsole,
  desktopSaveWorkerConnection,
  desktopVerifyWorkerConnection,
  explainDesktopError,
  explainWorkerUpdateTargetError,
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
import { DesktopErrorBanner } from "@/lib/desktop/shell";
import { downloadPasstokenBackup } from "@/lib/desktop/worker-url/download-passtoken-backup";
import { useAppSession } from "@/lib/desktop/app-session";
import { useDesktop } from "@/lib/desktop/shell";
import { CloudflareModuleIcon } from "@/console/components/CloudflareModuleIcon";
import {
  InstallWipeConfirmDialog,
  occupancySummary,
  resourceIsOccupied,
  wipePhraseIsValid,
} from "@/console/components/setup/InstallWipeConfirmDialog";
import { useOpenEnableEmailApiDialog } from "@/console/components/setup/use-enable-email-api-dialog";
import { SetupBackLink, SetupScrollPage } from "@/console/components/setup/setup-page-chrome";
import type { InstallFlowPurpose } from "@/console/lib/install-flow";
import { loadPublicWorkerVersionCompare } from "@/lib/dashboard/list-cf-zones";
import { ownerAuthStatusForWorkerUrl } from "@/lib/desktop/auth/owner-session";
import Link from "next/link";

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

export function SetupProgressPanel({
  purpose = "install",
  fromRecover = false,
}: {
  purpose?: InstallFlowPurpose;
  /** Forgot-passtoken recover cannot enter Settings; keep update on /setup. */
  fromRecover?: boolean;
}) {
  const router = useRouter();
  const store = useAppSession();
  const { refresh, credentials } = useDesktop();
  const openEnableEmailApiDialog = useOpenEnableEmailApiDialog();
  const workerUpdateHref = fromRecover
    ? "/setup/worker-update"
    : "/settings/worker/update";
  const workerUpdateHomeHref = fromRecover
    ? "/setup/recover-admin"
    : "/settings/worker";
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
    revealedPasstoken: string;
  } | null>(null);
  const [pendingVerify, setPendingVerify] = useState<{
    workerUrl: string;
    workerVersion: string;
    dbAlreadyInitialized: boolean;
  } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<DesktopErrorHelp | null>(null);
  const [dbAlreadyInit, setDbAlreadyInit] = useState<{
    workerUrl: string;
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
  const [workerOwnerConfigured, setWorkerOwnerConfigured] = useState<
    boolean | null
  >(null);
  const [workerVersions, setWorkerVersions] = useState<{
    current: string;
    latest: string;
    needsUpgrade: boolean;
  } | null>(null);
  const [probedWorkerUrl, setProbedWorkerUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [tokenDownloaded, setTokenDownloaded] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [needsOwnerSetup, setNeedsOwnerSetup] = useState(false);
  const [installPepper, setInstallPepper] = useState<string | null>(null);
  const [creatingOwner, setCreatingOwner] = useState(false);
  const [mailApiDone, setMailApiDone] = useState(false);
  const [mailApiVerified, setMailApiVerified] = useState(false);
  const emailDialogShownRef = useRef(false);
  const confettiFiredRef = useRef(false);
  const [leavingToMailbox, setLeavingToMailbox] = useState(false);
  const [installLogExpanded, setInstallLogExpanded] = useState(false);
  const [r2DashboardOpened, setR2DashboardOpened] = useState(false);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const installStartedRef = useRef(false);
  const busyRef = useRef(false);
  const wipeProbeCancelledRef = useRef(false);

  const cfOAuthConnected = Boolean(
    credentials?.cfOauthRefreshToken?.trim() ||
      credentials?.cfOauthAccessToken?.trim(),
  );
  const cfOAuthAccountId =
    credentials?.cfOauthAccountId?.trim() ||
    credentials?.accountId?.trim() ||
    "";

  const openMailApiDialog = useCallback(
    (done: { workerUrl: string; revealedPasstoken?: string }) => {
      openEnableEmailApiDialog({
        allowSkip: true,
        accountId: cfOAuthAccountId,
        workerUrl: done.workerUrl,
        onVerified: () => {
          setMailApiVerified(true);
          setMailApiDone(true);
        },
        onSkip: () => {
          setMailApiVerified(false);
          setMailApiDone(true);
        },
      });
    },
    [openEnableEmailApiDialog, cfOAuthAccountId],
  );

  async function ensureOauthSession() {
    if (!cfOAuthConnected) {
      setError({
        title: "Connect Cloudflare first",
        detail:
          "Authorize Relaybase with Cloudflare before installing. There is no token to paste.",
        fix:
          purpose === "worker-update"
            ? "Go back and Authorize with Cloudflare on this Worker update page."
            : "Go back and click Authorize and install on Cloudflare.",
      });
      return false;
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
    if (purpose === "worker-update") return;
    if (!autoDone) {
      confettiFiredRef.current = false;
      setTokenDownloaded(false);
      setTokenSaved(false);
      return;
    }
    setInstallLogExpanded(false);
    if (!confettiFiredRef.current) {
      confettiFiredRef.current = true;
      fireInstallConfetti();
    }
    if (mailApiDone || emailDialogShownRef.current) return;
    if (needsOwnerSetup) return;
    if (autoDone.revealedPasstoken && !tokenSaved) return;
    emailDialogShownRef.current = true;
    openMailApiDialog(autoDone);
  }, [
    autoDone,
    mailApiDone,
    needsOwnerSetup,
    openMailApiDialog,
    purpose,
    tokenSaved,
  ]);

  useEffect(() => {
    if (!credentials) return;
    if (!cfOAuthConnected) {
      router.replace(
        purpose === "worker-update"
          ? workerUpdateHref
          : "/setup/install",
      );
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
    setWorkerOwnerConfigured(null);
    setWorkerVersions(null);
    setProbedWorkerUrl(null);
    setNeedsOwnerSetup(false);
    setInstallPepper(null);
    setTokenSaved(false);
    try {
      if (!(await ensureOauthSession())) {
        return;
      }
      if (purpose === "worker-update") {
        setProbing(false);
        await runWorkerUpdate();
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
      const workerUrl = probe.workersDevUrl?.trim() || null;
      setProbedWorkerUrl(workerUrl);
      if (workerUrl) {
        const [status, versions] = await Promise.all([
          ownerAuthStatusForWorkerUrl(workerUrl),
          loadPublicWorkerVersionCompare(workerUrl),
        ]);
        setWorkerOwnerConfigured(status.ownerConfigured);
        setWorkerVersions(versions);
      } else {
        setWorkerOwnerConfigured(null);
        setWorkerVersions(null);
      }
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
    connect?: WorkerConnectResult,
  ) {
    const workerUrl = connect?.workerUrl || result.workerUrl;
    await desktopSaveWorkerConnection({
      workerUrl,
      workerScriptName:
        connect?.workerScriptName || result.workerScriptName || "relaybase-api",
      workerVersion: result.workerVersion || connect?.version,
    });
    void desktopRegisterWorkerWithConsole(workerUrl).catch(() => {
      /* best-effort */
    });
    await refresh();
    setPendingVerify(null);
    setVerifyError(null);
    setCopiedToken(false);
    setTokenDownloaded(false);
    setTokenSaved(false);
    setMessage(`Connected to ${workerUrl}`);
    if (purpose === "worker-update") {
      setNeedsOwnerSetup(false);
      setInstallPepper(null);
      setAutoDone({ workerUrl, revealedPasstoken: "" });
      router.replace(workerUpdateHomeHref);
      return;
    }
    const pepper = result.authPepper?.trim() ?? "";
    if (pepper) {
      try {
        const issued = await desktopOwnerSetupAdmin({
          workerUrl,
          pepper,
        });
        setInstallPepper(null);
        setNeedsOwnerSetup(false);
        setTokenSaved(false);
        setTokenDownloaded(false);
        setCopiedToken(false);
        setAutoDone({
          workerUrl,
          revealedPasstoken: issued.passtoken,
        });
        fireInstallConfetti();
        return;
      } catch (err) {
        console.error("Auto setup-admin failed, falling back to manual issue", err);
        setNeedsOwnerSetup(true);
        setInstallPepper(pepper);
        setAutoDone({ workerUrl, revealedPasstoken: "" });
        return;
      }
    }
    let ownerConfigured = false;
    try {
      ownerConfigured = (await ownerAuthStatusForWorkerUrl(workerUrl))
        .ownerConfigured;
    } catch {
      ownerConfigured = false;
    }
    if (ownerConfigured) {
      setNeedsOwnerSetup(false);
      setInstallPepper(null);
      setAutoDone({ workerUrl, revealedPasstoken: "" });
      return;
    }
    setNeedsOwnerSetup(true);
    setInstallPepper(null);
    setAutoDone({ workerUrl, revealedPasstoken: "" });
    setError({
      title: "Could not issue a passtoken",
      detail:
        "Install finished but AUTH_PEPPER was not available in memory to create the first owner.",
      fix: "Try again from Setup. If this Worker already has an owner, use I forgot my passtoken.",
    });
  }

  /** OAuth deploy already succeeded. No owner session is the normal upgrade case. */
  async function completeAfterDeploy(result: AutoInstallResult) {
    try {
      const connect = await desktopVerifyWorkerConnection(result.workerUrl);
      await finishInstall(result, connect);
    } catch {
      await finishInstall(result);
    }
  }

  async function runManualVerify() {
    if (!pendingVerify || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await desktopMigrateWorkerDb(pendingVerify.workerUrl);
      const connect = await desktopVerifyWorkerConnection(
        pendingVerify.workerUrl,
      );
      await finishInstall(
        {
          workerUrl: pendingVerify.workerUrl,
          workerScriptName: connect.workerScriptName,
          r2Bucket: "",
          d1LogsId: "",
          d1MailId: "",
          d1InboxIndexId: "",
          d1DbId: "",
          dbAlreadyInitialized: pendingVerify.dbAlreadyInitialized,
          dbApplied: [],
          workerVersion: pendingVerify.workerVersion,
        },
        connect,
      );
    } catch {
      await finishInstall({
        workerUrl: pendingVerify.workerUrl,
        workerScriptName: "relaybase-api",
        r2Bucket: "",
        d1LogsId: "",
        d1MailId: "",
        d1InboxIndexId: "",
        d1DbId: "",
        dbAlreadyInitialized: pendingVerify.dbAlreadyInitialized,
        dbApplied: [],
        workerVersion: pendingVerify.workerVersion,
      });
    } finally {
      setVerifying(false);
    }
  }

  function openWipe(intent: WipeIntent, targets: InstallResourceProbe[]) {
    setWipeIntent(intent);
    setWipeTargets(targets);
    setWipeOpen(true);
  }

  function handleWipeOpenChange(open: boolean) {
    setWipeOpen(open);
    if (!open) {
      wipeProbeCancelledRef.current = true;
      setWipeProbing(false);
    }
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
      await completeAfterDeploy(result);
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

  async function runWorkerUpdate() {
    busyRef.current = true;
    setBusy(true);
    setStopping(false);
    setStopped(false);
    setError(null);
    setMessage(null);
    setLogs([]);
    setAutoDone(null);
    setPendingVerify(null);
    setVerifyError(null);
    if (!(await ensureOauthSession())) {
      busyRef.current = false;
      setBusy(false);
      return;
    }
    let unlisten: (() => void) | null = null;
    try {
      const target = await desktopPreviewWorkerUpdateTarget();
      if (!target.matches) {
        setError(
          explainWorkerUpdateTargetError(
            `WORKER_URL_ACCOUNT_MISMATCH: This Cloudflare login is a different account than your saved Worker.\nSaved Worker: ${target.expectedWorkerUrl}\nThis login would update: ${target.oauthWorkerUrl}`,
          ),
        );
        busyRef.current = false;
        setBusy(false);
        return;
      }
      unlisten = await listenInstallLog((event) => {
        setLogs((prev) => [...prev, event]);
      });
      const result = await desktopUpdateInstalledWorker();
      await completeAfterDeploy(result);
    } catch (err) {
      if (isInstallCancelledError(err)) {
        setStopped(true);
        setError(null);
      } else {
        setError(
          explainDesktopError(err, "Worker update failed", {
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
    setError(null);
    wipeProbeCancelledRef.current = false;
    openWipe({ kind: "rollback" }, []);
    setWipeProbing(true);
    try {
      if (!(await ensureOauthSession())) {
        handleWipeOpenChange(false);
        return;
      }
      const probe = await desktopProbeInstall(cfOAuthAccountId || undefined);
      if (wipeProbeCancelledRef.current) return;
      setWipeTargets(probe.resources.filter((r) => r.present));
    } catch (err) {
      if (!wipeProbeCancelledRef.current) {
        setWipeTargets(unknownOccupiedTargets());
        setError(
          explainDesktopError(err, "Could not check existing data before rollback"),
        );
      }
    } finally {
      setWipeProbing(false);
    }
  }

  async function runRollback(wipeConfirmation?: string | null) {
    if (rollingBack || busyRef.current) return;
    setRollingBack(true);
    setError(null);
    setLogs([]);
    setInstallLogExpanded(true);
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

  async function createFirstOwner() {
    if (!autoDone || creatingOwner) return;
    const pepper = installPepper?.trim() ?? "";
    if (!pepper) return;
    setCreatingOwner(true);
    setError(null);
    try {
      const issued = await desktopOwnerSetupAdmin({
        workerUrl: autoDone.workerUrl,
        pepper,
      });
      setInstallPepper(null);
      setNeedsOwnerSetup(false);
      setTokenSaved(false);
      setTokenDownloaded(false);
      setCopiedToken(false);
      setAutoDone({
        workerUrl: autoDone.workerUrl,
        revealedPasstoken: issued.passtoken,
      });
      fireInstallConfetti();
    } catch (err) {
      setError(explainDesktopError(err, "Could not create owner"));
    } finally {
      setCreatingOwner(false);
    }
  }

  async function copyAutoToken() {
    if (!autoDone?.revealedPasstoken) return;
    await navigator.clipboard.writeText(autoDone.revealedPasstoken);
    setCopiedToken(true);
    setTokenSaved(true);
  }

  async function downloadAutoToken() {
    if (!autoDone?.revealedPasstoken) return;
    await downloadPasstokenBackup(autoDone.revealedPasstoken);
    setTokenDownloaded(true);
    setTokenSaved(true);
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
            "This deletes the Relaybase Worker, D1 databases, and R2 mailbox bucket in this Cloudflare account. If this is a live mailbox, mail and product data are gone permanently. Type DELETE ME to confirm.",
          confirmLabel: "Confirm rollback",
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
      setError({
        title: "Cannot wipe via init-db",
        detail:
          "init-db refuses existing data. SQL DROP is no longer available.",
        fix: "Mark D1 as Reinstall on the existing-resources step, or delete the databases in Cloudflare and create empty ones.",
      });
      return;
    }
    setAutoDone({
      workerUrl: dbAlreadyInit.workerUrl,
      revealedPasstoken: "",
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
          href={purpose === "worker-update" ? workerUpdateHomeHref : "/setup"}
          label={
            purpose === "worker-update"
              ? fromRecover
                ? "Back"
                : "Back to Worker settings"
              : "Back to start"
          }
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
                : purpose === "worker-update"
                  ? "Updating Worker"
                  : "Installing"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {autoDone
              ? "Your Worker is live."
              : pendingVerify
              ? "The Worker was uploaded. Confirm it is responding before continuing."
              : existing.length > 0 && !busy && !autoDone
              ? "Some Relaybase resources already exist in this Cloudflare account. Choose Skip or Reinstall for each, then continue."
              : probing
                ? "Looking for an existing Worker, R2 bucket, and D1 databases before creating anything."
                : purpose === "worker-update"
                  ? "Uploading the Worker script, then applying pending migrations. R2 and D1 are not recreated."
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
            {workerVersions?.needsUpgrade ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                <p className="font-medium">You should upgrade</p>
                <p className="mt-1 text-muted-foreground">
                  This Worker is older than the current install package. Skip
                  all resources, then use{" "}
                  <Link
                    href="/setup/connect"
                    className="underline underline-offset-2"
                  >
                    Already installed
                  </Link>{" "}
                  to sign in and open Settings → Update Worker. Do not
                  Reinstall Worker from Setup.
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border border-amber-500/20 bg-background/40 px-3 py-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Running
                    </p>
                    <p className="font-mono text-sm">
                      v{workerVersions.current}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Latest
                    </p>
                    <p className="font-mono text-sm">
                      v{workerVersions.latest}
                    </p>
                  </div>
                </div>
                {probedWorkerUrl ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {probedWorkerUrl}
                  </p>
                ) : null}
              </div>
            ) : workerOwnerConfigured ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300">
                <p className="font-medium">Existing Worker detected</p>
                <p className="mt-1 text-muted-foreground">
                  An owner is already configured in D1. Reinstalling or creating the Worker again will issue a new owner passtoken and connect this Mac.
                  If you already have your passtoken, you can sign in via{" "}
                  <Link
                    href="/setup/connect"
                    className="underline underline-offset-2"
                  >
                    Already installed
                  </Link>{" "}
                  or use{" "}
                  <Link
                    href="/setup/recover-admin"
                    className="underline underline-offset-2"
                  >
                    I forgot my passtoken
                  </Link>
                  .
                </p>
                {workerVersions ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    v{workerVersions.current} · latest v{workerVersions.latest}
                  </p>
                ) : null}
                {probedWorkerUrl ? (
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {probedWorkerUrl}
                  </p>
                ) : null}
              </div>
            ) : workerVersions ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                Worker v{workerVersions.current} · latest v
                {workerVersions.latest}
              </p>
            ) : null}
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
                        {r.kind === "worker" && workerVersions ? (
                          <p
                            className={
                              workerVersions.needsUpgrade
                                ? "text-[11px] text-amber-700 dark:text-amber-400"
                                : "text-[11px] text-muted-foreground"
                            }
                          >
                            v{workerVersions.current}
                            {workerVersions.latest
                              ? ` · latest v${workerVersions.latest}`
                              : ""}
                          </p>
                        ) : occupancySummary(r) ? (
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
              seconds and Try again. If it says the script is too old, re-pack
              with <code>pnpm pack:worker-install</code> and deploy the website.
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
              {autoDone.revealedPasstoken ? (
                <>
                  <p className="text-xs font-medium">Save your passtoken</p>
                  <p className="text-xs text-muted-foreground">
                    Shown once. Copy or download a backup — this Mac also
                    stores it in the keyring, and Touch ID reads it later.
                  </p>
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <code className="block break-all font-mono text-[11px]">
                      {autoDone.revealedPasstoken}
                    </code>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      variant={copiedToken || tokenSaved ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => void copyAutoToken()}
                    >
                      {copiedToken ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                      Copy passtoken
                    </Button>
                    <Button
                      type="button"
                      variant={tokenDownloaded ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => void downloadAutoToken()}
                    >
                      {tokenDownloaded ? (
                        <Check className="size-3.5" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Download .txt
                    </Button>
                  </div>
                  {tokenSaved ? (
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Passtoken saved. You can continue.
                    </p>
                  ) : (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400">
                      Copy or download before Go to Mailbox.
                    </p>
                  )}
                </>
              ) : needsOwnerSetup ? (
                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void createFirstOwner();
                  }}
                >
                  <p className="text-xs font-medium">Create the owner login</p>
                  <p className="text-xs text-muted-foreground">
                    We issue a passtoken once — copy or download it before
                    opening the mailbox.
                  </p>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={creatingOwner || !installPepper}
                  >
                    {creatingOwner ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    Issue passtoken
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Sign in with your passtoken to open the mailbox. Use{" "}
                  <Link
                    href="/setup/connect"
                    className="underline underline-offset-2"
                  >
                    Already installed
                  </Link>{" "}
                  if you are not signed in yet.
                </p>
              )}
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
                  onClick={() => {
                    if (autoDone) openMailApiDialog(autoDone);
                  }}
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
              disabled={
                leavingToMailbox ||
                needsOwnerSetup ||
                (Boolean(autoDone.revealedPasstoken) && !tokenSaved) ||
                !mailApiDone
              }
              onClick={() => {
                void (async () => {
                  setLeavingToMailbox(true);
                  if (autoDone.revealedPasstoken) {
                    try {
                      await store.loginWithPasstoken({
                        workerUrl: autoDone.workerUrl,
                        passtoken: autoDone.revealedPasstoken,
                      });
                      router.replace("/email/inbox");
                      return;
                    } catch {
                      setLeavingToMailbox(false);
                      store.openAlreadyInstalled();
                      router.replace("/setup/connect");
                      return;
                    }
                  }
                  if (store.canShowApp) {
                    router.replace("/email/inbox");
                    return;
                  }
                  store.openAlreadyInstalled();
                  router.replace("/setup/connect");
                })();
              }}
            >
              {leavingToMailbox ? "Opening…" : "Go to Mailbox"}
            </Button>
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
                    ? "Stopping…"
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
              Log
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
                  Log
                  <ChevronUp className="size-3.5" />
                </button>
              ) : (
                <p className="text-xs font-medium">Log</p>
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
          error.title.toLowerCase().includes("authorization expired") ||
          error.title.toLowerCase().includes("wrong cloudflare account") ? (
            <Button
              type="button"
              className="w-full"
              onClick={() =>
                router.push(
                  purpose === "worker-update"
                    ? workerUpdateHref
                    : "/setup/install",
                )
              }
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
                    error.links?.find((l) =>
                      l.label.toLowerCase().includes("cloudflare"),
                    )?.href ||
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
                <>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => void startFlow()}
                  >
                    I&apos;ve added R2 — continue
                  </Button>
                  <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                    It can take 1–2 minutes for Cloudflare to activate the
                    subscription across its API after adding a payment method.
                  </p>
                </>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="w-full text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const learnMoreHref =
                    error.links?.find(
                      (l) => !l.label.toLowerCase().includes("cloudflare"),
                    )?.href ||
                    "https://relaybase.xyz/resources/why-cloudflare-r2-for-email";
                  void desktopOpenExternal(learnMoreHref);
                }}
              >
                Why is R2 required? (10 GB free tier)
                <ExternalLink className="size-3" />
              </Button>
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

        {purpose === "install" &&
        !busy &&
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
            Rollback
          </Button>
        ) : null}

        <InstallWipeConfirmDialog
          open={wipeOpen}
          onOpenChange={handleWipeOpenChange}
          title={wipeDialogCopy().title}
          description={wipeDialogCopy().description}
          targets={wipeTargets}
          confirmLabel={wipeDialogCopy().confirmLabel}
          onConfirm={onWipeConfirm}
          confirming={rollingBack || clearingDb}
          checking={wipeProbing && wipeIntent?.kind === "rollback"}
          checkingMessage="Checking existing Cloudflare resources…"
          requirePhrase={wipeIntent?.kind === "rollback"}
        />

      </div>
    </SetupScrollPage>
  );
}
