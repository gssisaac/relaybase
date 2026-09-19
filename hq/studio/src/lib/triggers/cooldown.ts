import { readStudioDocument, mutateStudioDocument } from "@services/studio/studio-document.service";

export function isWithinTriggerCooldown(
  triggerId: string,
  email: string,
  cooldownSeconds: number,
  nowMs = Date.now(),
): boolean {
  if (cooldownSeconds <= 0) return false;
  const normalized = email.trim().toLowerCase();
  const cutoff = nowMs - cooldownSeconds * 1000;
  const sends = readStudioDocument().triggerSends;
  for (let i = sends.length - 1; i >= 0; i -= 1) {
    const row = sends[i]!;
    if (row.triggerId !== triggerId) continue;
    if (row.email.trim().toLowerCase() !== normalized) continue;
    if (row.status === "skipped" || row.status === "failed") continue;
    const sentAt = row.sentAt ?? row.createdAt;
    const ts = Date.parse(sentAt);
    if (!Number.isNaN(ts) && ts >= cutoff) return true;
  }
  return false;
}
