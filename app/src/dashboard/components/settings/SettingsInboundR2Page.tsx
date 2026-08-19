"use client";

import { HardDrive } from "lucide-react";

import { useSettingsConnection } from "@/dashboard/components/settings/SettingsConnectionContext";
import {
  R2_INBOUND_SIZE_LIMIT_BYTES,
  SettingsPageBody,
  StorageBindingCard,
} from "@/dashboard/components/settings/settings-shared";

export function SettingsInboundR2Page() {
  const { workerStatus, r2Health, hasWorker, statusBusy } =
    useSettingsConnection();

  const pending = statusBusy && workerStatus == null;
  const configured = workerStatus?.r2Configured ?? false;
  const bucketName = workerStatus?.inboundBucketName || "relaybase-inbound";
  const sizePending =
    pending || (statusBusy && configured && workerStatus?.r2TotalBytes == null);

  return (
    <SettingsPageBody>
      <p className="text-sm text-muted-foreground">
        Inbound email storage probed via{" "}
        <span className="font-mono">GET /console/connect</span>. Bar shows
        usage against the 10 GB included R2 storage reference.
      </p>
      <StorageBindingCard
        icon={HardDrive}
        title="Inbound R2"
        description="Raw MIME payloads for received mail. Create the bucket in your account before deploy."
        status={r2Health}
        resourceLabel="Bucket"
        resourceName={bucketName}
        binding="INBOUND"
        usedBytes={configured ? (workerStatus?.r2TotalBytes ?? null) : null}
        limitBytes={R2_INBOUND_SIZE_LIMIT_BYTES}
        pending={sizePending}
        truncated={workerStatus?.r2UsageTruncated ?? undefined}
        footer={
          hasWorker ? (
            <div>
              <p className="text-xs text-muted-foreground">Objects</p>
              <p className="mt-0.5 font-mono text-xs">
                {sizePending && workerStatus?.r2ObjectCount == null
                  ? "…"
                  : workerStatus?.r2ObjectCount != null
                    ? `${workerStatus.r2ObjectCount.toLocaleString()}${
                        workerStatus.r2UsageTruncated ? "+" : ""
                      }`
                    : "—"}
              </p>
            </div>
          ) : null
        }
      />
    </SettingsPageBody>
  );
}
