import type { TriggerPurpose, TriggerSource } from "../../db/types";

export function defaultFromForDomain(domain: string): string {
  return `hello@${domain}`;
}

export function purposeFromInput(raw: string | undefined): TriggerPurpose {
  if (raw === "conversational" || raw === "marketing") return raw;
  return "transactional";
}

export function mergeTriggerPatch(
  existing: TriggerSource,
  patch: Partial<TriggerSource> | TriggerSource | undefined,
): TriggerSource {
  if (!patch || typeof patch !== "object") return existing;
  if ("type" in patch && patch.type && patch.type !== existing.type) {
    return patch as TriggerSource;
  }
  return { ...existing, ...patch } as TriggerSource;
}
