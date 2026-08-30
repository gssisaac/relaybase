import { readUiJson, UI_FILES, writeUiJson } from "@/email/lib/disk/user-ui-disk";
import type { Address } from "@/email/components/mailbox/types";

export type AvailableAddressesHydrate = {
  /** True when the disk file exists (including an authoritative empty list). */
  found: boolean;
  addresses: Address[];
};

function normalizeAddress(raw: unknown): Address | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const email = typeof rec.email === "string" ? rec.email.trim() : "";
  if (!email) return null;
  const at = email.lastIndexOf("@");
  const domain =
    typeof rec.domain === "string" && rec.domain.trim()
      ? rec.domain.trim()
      : at > 0
        ? email.slice(at + 1)
        : "";
  const address: Address = { email, domain };
  if (typeof rec.displayName === "string") address.displayName = rec.displayName;
  if (typeof rec.signature === "string") address.signature = rec.signature;
  if (rec.inboundEnabled === false) address.inboundEnabled = false;
  if (rec.mobileEnabled === false) address.mobileEnabled = false;
  return address;
}

export function normalizeAddresses(raw: unknown): Address[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Address[] = [];
  for (const item of raw) {
    const addr = normalizeAddress(item);
    if (!addr) continue;
    const key = addr.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(addr);
  }
  return out;
}

/** Upgrade seed: enable-list emails → catalog rows when no cache file exists. */
export function addressesFromEmails(emails: string[]): Address[] {
  return normalizeAddresses(
    emails.map((email) => {
      const trimmed = email.trim();
      const at = trimmed.lastIndexOf("@");
      return {
        email: trimmed,
        domain: at > 0 ? trimmed.slice(at + 1) : "",
      };
    }),
  );
}

export function writeAvailableAddresses(userId: string, addresses: Address[]) {
  const next = normalizeAddresses(addresses);
  void writeUiJson(userId, UI_FILES.availableAddresses, {
    version: 1,
    addresses: next,
  }).catch((err) => {
    console.error("[relaybase] failed to persist available addresses", err);
  });
}

/** Load from ~/.relaybase (desktop). Missing file is not the same as empty. */
export async function hydrateAvailableAddresses(
  userId: string,
): Promise<AvailableAddressesHydrate> {
  if (!userId) return { found: false, addresses: [] };
  const disk = await readUiJson<{ version?: unknown; addresses?: unknown }>(
    userId,
    UI_FILES.availableAddresses,
  );
  if (disk && (Array.isArray(disk.addresses) || disk.version === 1)) {
    return { found: true, addresses: normalizeAddresses(disk.addresses) };
  }
  return { found: false, addresses: [] };
}
