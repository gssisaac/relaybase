"use client";

import { Database } from "lucide-react";

import { D1_DATABASE_SIZE_LIMIT_BYTES } from "@/lib/dashboard/d1-binding-status";
import type { D1BindingSnapshot } from "@/lib/dashboard/d1-binding-status";
import { useSettingsConnection } from "@/console/pages/settings/SettingsConnectionContext";
import {
  SettingsPageBody,
  StorageBindingCard,
} from "@/console/pages/settings/settings-shared";

function d1Status(
  hasWorker: boolean,
  pending: boolean,
  binding: D1BindingSnapshot | undefined,
  probeDetail: string,
  okDetail: string,
  failDetail: string,
) {
  if (!hasWorker) {
    return {
      tone: "bad" as const,
      label: "Unavailable",
      detail: "Connect a routing Worker first.",
    };
  }
  if (pending) {
    return {
      tone: "pending" as const,
      label: "Checking…",
      detail: probeDetail,
    };
  }
  if (binding?.configured) {
    return {
      tone: "ok" as const,
      label: "Configured",
      detail: okDetail,
    };
  }
  return {
    tone: "bad" as const,
    label: "Not configured",
    detail: failDetail,
  };
}

export function SettingsD1Page() {
  const { workerStatus, hasWorker, statusBusy } = useSettingsConnection();

  const logs = workerStatus?.d1Logs;
  const mail = workerStatus?.d1Mail;
  const app = workerStatus?.d1App;
  const pending = statusBusy && workerStatus == null;

  const logsBinding =
    logs ?? {
      configured: false,
      databaseName: "relaybase-logs",
      binding: "RELAYBASE_LOGS",
      sizeBytes: null,
    };

  const mailBinding =
    mail ?? {
      configured: false,
      databaseName: "relaybase-mail",
      binding: "RELAYBASE_MAIL",
      sizeBytes: null,
    };

  const appBinding =
    app ?? {
      configured: false,
      databaseName: "relaybase-db",
      binding: "RELAYBASE_DB",
      sizeBytes: null,
    };

  return (
    <SettingsPageBody>
      <p className="text-sm text-muted-foreground">
        Optional D1 databases probed via{" "}
        <span className="font-mono">GET /console/connect</span>. Bar shows
        usage against the 10 GB per-database Cloudflare limit.
      </p>
      <StorageBindingCard
        icon={Database}
        title="Ops log"
        description="Compose/API/broadcast sends and inbound bounces for the Dashboard Log page."
        status={d1Status(
          hasWorker,
          pending,
          logs,
          "Probing RELAYBASE_LOGS binding.",
          "Ops log table is reachable.",
          "Bind RELAYBASE_LOGS and run POST /console/init-db.",
        )}
        resourceLabel="Database"
        resourceName={logsBinding.databaseName}
        binding={logsBinding.binding}
        usedBytes={logsBinding.configured ? logsBinding.sizeBytes : null}
        limitBytes={D1_DATABASE_SIZE_LIMIT_BYTES}
        pending={pending && logsBinding.configured && logsBinding.sizeBytes == null}
      />
      <StorageBindingCard
        icon={Database}
        title="Mailbox"
        description="List/count/search index for inbound + sent mail (FTS5 over subject, from, to, cc, body)."
        status={d1Status(
          hasWorker,
          pending,
          mail,
          "Probing RELAYBASE_MAIL binding.",
          "Mailbox index is reachable.",
          "Bind RELAYBASE_MAIL and run POST /console/init-db.",
        )}
        resourceLabel="Database"
        resourceName={mailBinding.databaseName}
        binding={mailBinding.binding}
        usedBytes={mailBinding.configured ? mailBinding.sizeBytes : null}
        limitBytes={D1_DATABASE_SIZE_LIMIT_BYTES}
        pending={
          pending && mailBinding.configured && mailBinding.sizeBytes == null
        }
      />
      <StorageBindingCard
        icon={Database}
        title="Product DB"
        description="Durable product state: mailbox, audience, broadcasts, keys, tokens, branding, webhooks."
        status={d1Status(
          hasWorker,
          pending,
          app,
          "Probing RELAYBASE_DB binding.",
          "Product DB tables are reachable.",
          "Bind RELAYBASE_DB and run POST /console/init-db.",
        )}
        resourceLabel="Database"
        resourceName={appBinding.databaseName}
        binding={appBinding.binding}
        usedBytes={appBinding.configured ? appBinding.sizeBytes : null}
        limitBytes={D1_DATABASE_SIZE_LIMIT_BYTES}
        pending={pending && appBinding.configured && appBinding.sizeBytes == null}
      />
    </SettingsPageBody>
  );
}
