import type { InstallDecision } from "@/lib/desktop/bridge";

export const SIGNUP_R2_BUCKET = "relaybase-mailbox";
export const SIGNUP_WORKER_SCRIPT = "relaybase-api";

export const SIGNUP_D1_DATABASES = [
  {
    moduleId: "d1-relaybase-logs",
    dbName: "relaybase-logs",
    title: "Logs database (relaybase-logs)",
    description: "D1 database for operational logs and diagnostics.",
  },
  {
    moduleId: "d1-relaybase-mail",
    dbName: "relaybase-mail",
    title: "Mail metadata (relaybase-mail)",
    description: "D1 database for mailbox indexes and message metadata.",
  },
  {
    moduleId: "d1-relaybase-db",
    dbName: "relaybase-db",
    title: "Core database (relaybase-db)",
    description: "D1 database for domains, settings, and console metadata.",
  },
] as const;

export type D1InstallModuleId = (typeof SIGNUP_D1_DATABASES)[number]["moduleId"];

export type InstallModuleId = "r2" | D1InstallModuleId | "worker-setup";

export type InstallModuleStatus = "pending" | "running" | "done" | "error";

export type InstallModuleEvent = {
  id: InstallModuleId;
  status: InstallModuleStatus;
  /** Cloudflare resource id (e.g. D1 database uuid) when module completes. */
  cfResourceId?: string;
};

export type SignupInstallModuleDef = {
  id: InstallModuleId;
  title: string;
  description: string;
  icon: "R2" | "D1" | "Worker";
};

export const SIGNUP_INSTALL_MODULES: SignupInstallModuleDef[] = [
  {
    id: "r2",
    title: "Mailbox storage (R2)",
    description: "Creates the R2 bucket for attachments and raw message storage.",
    icon: "R2",
  },
  ...SIGNUP_D1_DATABASES.map((row) => ({
    id: row.moduleId,
    title: row.title,
    description: row.description,
    icon: "D1" as const,
  })),
  {
    id: "worker-setup",
    title: "Email Worker setup",
    description:
      "Deploys relaybase-api, sets Worker secrets, warms up the service, and applies schema when the Worker is updated.",
    icon: "Worker",
  },
];

export const SIGNUP_MODULE_ORDER: InstallModuleId[] = SIGNUP_INSTALL_MODULES.map((m) => m.id);

export function d1ModuleIdForDbName(dbName: string): D1InstallModuleId | null {
  return SIGNUP_D1_DATABASES.find((d) => d.dbName === dbName)?.moduleId ?? null;
}

export function installResourceAction(
  decisions: InstallDecision[],
  kind: string,
  name: string,
): "install" | "skip" | "reinstall" {
  if (decisions.length === 0) return "install";
  const row = decisions.find((d) => d.kind === kind && d.name === name);
  if (!row) return "install";
  return row.action;
}

export function shouldRunSignupModule(id: InstallModuleId, decisions: InstallDecision[]): boolean {
  if (id === "r2") {
    return installResourceAction(decisions, "r2", SIGNUP_R2_BUCKET) !== "skip";
  }
  const d1 = SIGNUP_D1_DATABASES.find((d) => d.moduleId === id);
  if (d1) {
    return installResourceAction(decisions, "d1", d1.dbName) !== "skip";
  }
  if (id === "worker-setup") {
    return installResourceAction(decisions, "worker", SIGNUP_WORKER_SCRIPT) !== "skip";
  }
  return true;
}

export function visibleSignupInstallModules(
  decisions: InstallDecision[],
): SignupInstallModuleDef[] {
  return SIGNUP_INSTALL_MODULES.filter((m) => shouldRunSignupModule(m.id, decisions));
}

export function installLogModuleForStep(step: string): InstallModuleId | null {
  if (step === "r2") return "r2";
  if (step.startsWith("d1-")) return step as InstallModuleId;
  if (step === "worker-setup") return "worker-setup";
  return null;
}

export function emptyModuleState(
  modules: SignupInstallModuleDef[],
): Record<InstallModuleId, InstallModuleStatus> {
  const next = {} as Record<InstallModuleId, InstallModuleStatus>;
  for (const mod of modules) {
    next[mod.id] = "pending";
  }
  return next;
}

export function emptyModuleLogs(
  modules: SignupInstallModuleDef[],
): Record<InstallModuleId, string[]> {
  const next = {} as Record<InstallModuleId, string[]>;
  for (const mod of modules) {
    next[mod.id] = [];
  }
  return next;
}
