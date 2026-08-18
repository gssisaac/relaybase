"use client";

import { Database } from "lucide-react";

import { D1_DATABASE_SIZE_LIMIT_BYTES } from "@/lib/dashboard/d1-binding-status";
import type { D1BindingSnapshot } from "@/lib/dashboard/d1-binding-status";
import { useSettingsConnection } from "@/dashboard/components/settings/SettingsConnectionContext";
import {
  SettingsPageBody,
  StorageBindingCard,
} from "@/dashboard/components/settings/settings-shared";

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
  const inboxIndex = workerStatus?.d1InboxIndex;
  const pending = statusBusy && workerStatus == null;

  const logsBinding =
    logs ?? {
      configured: false,
      databaseName: "relaybase-logs",
      binding: "RELAYBASE_LOGS",
      sizeBytes: null,
    };

  const inboxBinding =
    inboxIndex ?? {
      configured: false,
      databaseName: "relaybase-inbox-index",
      binding: "RELAYBASE_INBOX_INDEX",
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
          "Bind RELAYBASE_LOGS and apply migrations-logs.",
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
        title="Inbox search"
        description="FTS5 index for server-side inbox search (subject, from, to, body)."
        status={d1Status(
          hasWorker,
          pending,
          inboxIndex,
          "Probing RELAYBASE_INBOX_INDEX binding.",
          "Inbox search index is reachable.",
          "Bind RELAYBASE_INBOX_INDEX and apply migrations-inbox.",
        )}
        resourceLabel="Database"
        resourceName={inboxBinding.databaseName}
        binding={inboxBinding.binding}
        usedBytes={inboxBinding.configured ? inboxBinding.sizeBytes : null}
        limitBytes={D1_DATABASE_SIZE_LIMIT_BYTES}
        pending={
          pending && inboxBinding.configured && inboxBinding.sizeBytes == null
        }
      />
    </SettingsPageBody>
  );
}
