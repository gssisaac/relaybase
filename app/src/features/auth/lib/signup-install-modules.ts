import type { InstallModuleId } from "@/lib/desktop/bridge/web-install-stream";

export type SignupInstallModuleDef = {
  id: InstallModuleId;
  title: string;
  description: string;
  icon: "R2" | "D1" | "Worker" | "Shield";
};

export const SIGNUP_INSTALL_MODULES: SignupInstallModuleDef[] = [
  {
    id: "r2",
    title: "Mailbox storage (R2)",
    description: "Creates the R2 bucket for attachments and raw message storage.",
    icon: "R2",
  },
  {
    id: "d1",
    title: "Relaybase database (D1)",
    description: "Provisions D1 databases for domains, settings, and mail metadata.",
    icon: "D1",
  },
  {
    id: "worker",
    title: "Email worker script",
    description: "Deploys the relaybase-api worker, bindings, and cron schedules.",
    icon: "Worker",
  },
  {
    id: "secrets",
    title: "Security & secrets",
    description: "Sets AUTH_PEPPER and Cloudflare Worker secrets for your account.",
    icon: "Shield",
  },
  {
    id: "schema",
    title: "Database initialization",
    description: "Warms up the worker and applies schema migrations.",
    icon: "D1",
  },
];

export const SIGNUP_MODULE_ORDER = SIGNUP_INSTALL_MODULES.map((m) => m.id);

export function installLogModuleForStep(step: string): InstallModuleId | null {
  if (step === "r2") return "r2";
  if (step === "d1") return "d1";
  if (step === "prepare" || step === "deploy") return "worker";
  if (step === "secret") return "secrets";
  if (step === "warmup" || step === "init-db" || step === "migrate-db" || step === "setup-admin") {
    return "schema";
  }
  return null;
}
