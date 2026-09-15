import type { AudienceDataSource } from "../../db/types";

export function mergeDataSource(
  existing: AudienceDataSource | null,
  incoming: AudienceDataSource | null | undefined,
  keepCredential: boolean,
): AudienceDataSource | null {
  if (incoming === null) return null;
  if (!incoming) return existing;
  const credential =
    incoming.credential?.trim() ||
    (keepCredential ? existing?.credential : undefined) ||
    undefined;
  return {
    type: "generic_json",
    endpointUrl: incoming.endpointUrl.trim(),
    credential,
    credentialHeader: incoming.credentialHeader?.trim() || undefined,
  };
}
